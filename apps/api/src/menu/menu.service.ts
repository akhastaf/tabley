import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MenuCategoryEntity,
  type MenuCategoryTranslations,
  MenuItemEntity,
  type MenuItemTranslations,
  TenantEntity,
  type TenantMenuLanguage,
} from '@tabley/database';
import type { NutritionInfo } from '@tabley/shared';
import { SearchSync } from '../search/search.sync';
import { TranslateService } from '../translate/translate.service';
import { isOpenNow } from '../tenant-settings/opening-hours';

// Display names for the common base locales the app ships with. The base menu
// language is always the tenant's default_locale; added languages carry their
// own display name.
const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  ar: 'العربية',
};

function localeName(code: string): string {
  return LOCALE_NAMES[code] ?? code.toUpperCase();
}

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategoryEntity)
    private readonly categories: Repository<MenuCategoryEntity>,
    @InjectRepository(MenuItemEntity) private readonly items: Repository<MenuItemEntity>,
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    private readonly searchSync: SearchSync,
    private readonly translate: TranslateService,
  ) {}

  listCategories(tenantId: string) {
    return this.categories.find({
      where: { tenantId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  async createCategory(tenantId: string, input: { name: string; position?: number }) {
    const entity = this.categories.create({
      tenantId,
      name: input.name,
      position: input.position ?? 0,
    });
    return this.categories.save(entity);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    patch: { name?: string; position?: number; translations?: MenuCategoryTranslations },
  ) {
    const row = await this.categories.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Not found' });
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.position !== undefined) row.position = patch.position;
    if (patch.translations !== undefined) {
      row.translations = { ...(row.translations ?? {}), ...patch.translations };
    }
    const saved = await this.categories.save(row);
    // Renaming a category changes the `categoryName` we denormalise into the
    // search index — resync every item under it.
    if (patch.name !== undefined) {
      const items = await this.items.find({ where: { categoryId: id, tenantId } });
      await Promise.all(items.map((i) => this.searchSync.syncMenuItemById(i.id)));
    }
    return saved;
  }

  async deleteCategory(tenantId: string, id: string) {
    const row = await this.categories.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Not found' });
    const items = await this.items.find({ where: { categoryId: id, tenantId } });
    await this.categories.remove(row);
    await Promise.all(items.map((i) => this.searchSync.deleteMenuItem(i.id)));
  }

  listItems(tenantId: string) {
    return this.items.find({
      where: { tenantId },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
  }

  async createItem(
    tenantId: string,
    input: {
      categoryId: string;
      name: string;
      description?: string;
      priceCents: number;
      allergens?: string[];
      labels?: string[];
      nutrition?: NutritionInfo | null;
      available?: boolean;
      position?: number;
    },
  ) {
    const category = await this.categories.findOne({
      where: { id: input.categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }
    const entity = this.items.create({
      tenantId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      priceCents: input.priceCents,
      allergens: input.allergens ?? [],
      labels: input.labels ?? [],
      nutrition: input.nutrition ?? null,
      available: input.available ?? true,
      position: input.position ?? 0,
    });
    const saved = await this.items.save(entity);
    await this.searchSync.syncMenuItemById(saved.id);
    return saved;
  }

  async updateItem(
    tenantId: string,
    id: string,
    patch: {
      categoryId?: string;
      name?: string;
      description?: string | null;
      priceCents?: number;
      imageUrl?: string | null;
      allergens?: string[];
      labels?: string[];
      nutrition?: NutritionInfo | null;
      available?: boolean;
      position?: number;
      translations?: MenuItemTranslations;
    },
  ) {
    const row = await this.items.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Not found' });
    if (patch.categoryId !== undefined) {
      const category = await this.categories.findOne({
        where: { id: patch.categoryId, tenantId },
      });
      if (!category) {
        throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
      }
      row.categoryId = patch.categoryId;
    }
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.priceCents !== undefined) row.priceCents = patch.priceCents;
    if (patch.imageUrl !== undefined) row.imageUrl = patch.imageUrl;
    if (patch.allergens !== undefined) row.allergens = patch.allergens;
    if (patch.labels !== undefined) row.labels = patch.labels;
    if (patch.nutrition !== undefined) row.nutrition = patch.nutrition;
    if (patch.available !== undefined) row.available = patch.available;
    if (patch.position !== undefined) row.position = patch.position;
    if (patch.translations !== undefined) {
      row.translations = { ...(row.translations ?? {}), ...patch.translations };
    }
    const saved = await this.items.save(row);
    // Items not available shouldn't appear in customer search. Sync mirrors
    // the row's current state (or removes it if `available: false`).
    if (patch.available === false) {
      await this.searchSync.deleteMenuItem(saved.id);
    } else {
      await this.searchSync.syncMenuItemById(saved.id);
    }
    return saved;
  }

  /**
   * Convenience for image uploads — sets `imageUrl` and re-syncs search
   * without requiring the caller to assemble a full patch object.
   */
  async setItemImage(tenantId: string, id: string, imageUrl: string) {
    return this.updateItem(tenantId, id, { imageUrl });
  }

  async deleteItem(tenantId: string, id: string) {
    const row = await this.items.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Not found' });
    await this.items.remove(row);
    await this.searchSync.deleteMenuItem(id);
  }

  async getPublicMenu(slug: string, lang?: string) {
    const tenant = await this.tenants.findOne({ where: { slug, isActive: true } });
    if (!tenant) {
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Restaurant not found' });
    }
    const [categories, items] = await Promise.all([
      this.categories.find({
        where: { tenantId: tenant.id, isActive: true },
        order: { position: 'ASC' },
      }),
      this.items.find({
        where: { tenantId: tenant.id, available: true },
        order: { position: 'ASC' },
      }),
    ]);
    const byCategory = new Map<string, MenuItemEntity[]>();
    for (const item of items) {
      const arr = byCategory.get(item.categoryId) ?? [];
      arr.push(item);
      byCategory.set(item.categoryId, arr);
    }

    // The first language is always the base (tenant default locale); the rest
    // are the manager-added languages. Overlay only when a non-base, known
    // language is requested.
    const languages = this.publicLanguages(tenant);
    const activeLang =
      lang && languages.some((l) => l.code === lang) ? lang : tenant.defaultLocale;
    const overlay = activeLang !== tenant.defaultLocale;

    const openStatus = isOpenNow({
      openingHours: tenant.openingHours,
      timezone: tenant.timezone,
    });
    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        locale: tenant.defaultLocale,
        deliveryEnabled: tenant.deliveryEnabled,
        logoUrl: tenant.logoUrl,
        // Public restaurant info — surfaced so the menu page can render the
        // address, contact details, map preview, and live "open now" badge.
        addressLine: tenant.addressLine,
        city: tenant.city,
        postalCode: tenant.postalCode,
        country: tenant.country,
        phone: tenant.phone,
        email: tenant.email,
        websiteUrl: tenant.websiteUrl,
        latitude: tenant.latitude !== null ? Number(tenant.latitude) : null,
        longitude: tenant.longitude !== null ? Number(tenant.longitude) : null,
        timezone: tenant.timezone,
        openingHours: tenant.openingHours,
        openNow: openStatus.open,
        openReason: openStatus.reason ?? null,
      },
      languages,
      activeLang,
      categories: categories.map((c) => ({
        id: c.id,
        name: (overlay && c.translations?.[activeLang]?.name) || c.name,
        position: c.position,
        items: (byCategory.get(c.id) ?? []).map((i) => {
          const tr = overlay ? i.translations?.[activeLang] : undefined;
          return {
            id: i.id,
            name: (tr?.name && tr.name.trim()) || i.name,
            description: tr?.description ?? i.description,
            priceCents: i.priceCents,
            imageUrl: i.imageUrl,
            allergens: i.allergens,
            labels: i.labels ?? [],
            nutrition: i.nutrition ?? null,
          };
        }),
      })),
    };
  }

  // --- Multi-language management ---

  /** Base language (default locale) followed by the added menu languages. */
  private publicLanguages(tenant: TenantEntity): TenantMenuLanguage[] {
    return [
      { code: tenant.defaultLocale, name: localeName(tenant.defaultLocale) },
      ...(tenant.menuLanguages ?? []),
    ];
  }

  async listLanguages(tenantId: string) {
    const tenant = await this.tenants.findOneByOrFail({ id: tenantId });
    return {
      defaultLocale: tenant.defaultLocale,
      base: { code: tenant.defaultLocale, name: localeName(tenant.defaultLocale) },
      languages: tenant.menuLanguages ?? [],
      translateEnabled: this.translate.isEnabled(),
    };
  }

  async addLanguage(tenantId: string, name: string) {
    const tenant = await this.tenants.findOneByOrFail({ id: tenantId });
    const langs = tenant.menuLanguages ?? [];
    const trimmed = name.trim();
    if (
      langs.some((l) => l.name.toLowerCase() === trimmed.toLowerCase()) ||
      trimmed.toLowerCase() === localeName(tenant.defaultLocale).toLowerCase()
    ) {
      throw new BadRequestException({
        code: 'LANGUAGE_EXISTS',
        message: 'That language is already on the menu',
      });
    }
    const taken = new Set([tenant.defaultLocale, ...langs.map((l) => l.code)]);
    const code = this.deriveLanguageCode(trimmed, taken);
    const next: TenantMenuLanguage = { code, name: trimmed };
    tenant.menuLanguages = [...langs, next];
    await this.tenants.save(tenant);
    return next;
  }

  async removeLanguage(tenantId: string, code: string) {
    const tenant = await this.tenants.findOneByOrFail({ id: tenantId });
    tenant.menuLanguages = (tenant.menuLanguages ?? []).filter((l) => l.code !== code);
    await this.tenants.save(tenant);

    // Strip the now-orphaned overlay from every category/item so search stays
    // clean and we don't keep dead translations around.
    const [categories, items] = await Promise.all([
      this.categories.find({ where: { tenantId } }),
      this.items.find({ where: { tenantId } }),
    ]);
    const changedCats = categories.filter((c) => c.translations && code in c.translations);
    for (const c of changedCats) {
      const { [code]: _drop, ...rest } = c.translations;
      c.translations = rest;
    }
    if (changedCats.length) await this.categories.save(changedCats);

    const changedItems = items.filter((i) => i.translations && code in i.translations);
    for (const i of changedItems) {
      const { [code]: _drop, ...rest } = i.translations;
      i.translations = rest;
    }
    if (changedItems.length) {
      await this.items.save(changedItems);
      await this.searchSync.syncMenuItems(changedItems);
    }
    return { ok: true };
  }

  /** Slugify a free-text language name into a stable, unique code. */
  private deriveLanguageCode(name: string, taken: Set<string>): string {
    const base =
      name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 16) || 'lang';
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`.slice(0, 16);
      if (!taken.has(candidate)) return candidate;
    }
  }

  private requireLanguage(tenant: TenantEntity, code: string): TenantMenuLanguage {
    const lang = (tenant.menuLanguages ?? []).find((l) => l.code === code);
    if (!lang) {
      throw new BadRequestException({
        code: 'LANGUAGE_NOT_FOUND',
        message: 'Add this language to the menu first',
      });
    }
    return lang;
  }

  /** AI-translate one item's name + description into a target language. */
  async translateItem(tenantId: string, id: string, code: string) {
    const tenant = await this.tenants.findOneByOrFail({ id: tenantId });
    const lang = this.requireLanguage(tenant, code);
    const item = await this.items.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Not found' });

    const baseName = localeName(tenant.defaultLocale);
    const [name, description] = await this.translate.translateBatch(
      [item.name, item.description ?? ''],
      lang.name,
      baseName,
    );
    item.translations = {
      ...(item.translations ?? {}),
      [code]: { name, description: item.description ? description : undefined },
    };
    const saved = await this.items.save(item);
    await this.searchSync.syncMenuItemById(saved.id);
    return saved;
  }

  /** AI-translate the whole menu (every category + item) into a language. */
  async translateMenu(tenantId: string, code: string) {
    const tenant = await this.tenants.findOneByOrFail({ id: tenantId });
    const lang = this.requireLanguage(tenant, code);
    const baseName = localeName(tenant.defaultLocale);

    const [categories, items] = await Promise.all([
      this.categories.find({ where: { tenantId } }),
      this.items.find({ where: { tenantId } }),
    ]);

    if (categories.length) {
      const names = await this.translateAll(
        categories.map((c) => c.name),
        lang.name,
        baseName,
      );
      categories.forEach((c, idx) => {
        c.translations = { ...(c.translations ?? {}), [code]: { name: names[idx] } };
      });
      await this.categories.save(categories);
    }

    if (items.length) {
      const [names, descriptions] = await Promise.all([
        this.translateAll(items.map((i) => i.name), lang.name, baseName),
        this.translateAll(items.map((i) => i.description ?? ''), lang.name, baseName),
      ]);
      items.forEach((i, idx) => {
        i.translations = {
          ...(i.translations ?? {}),
          [code]: {
            name: names[idx],
            description: i.description ? descriptions[idx] : undefined,
          },
        };
      });
      await this.items.save(items);
      await this.searchSync.syncMenuItems(items);
    }

    return { code, categories: categories.length, items: items.length };
  }

  /** Translate an arbitrary-length array in chunks to stay within model limits. */
  private async translateAll(
    texts: string[],
    targetLanguage: string,
    sourceLanguage: string,
  ): Promise<string[]> {
    const CHUNK = 80;
    if (texts.length <= CHUNK) {
      return this.translate.translateBatch(texts, targetLanguage, sourceLanguage);
    }
    const out: string[] = [];
    for (let i = 0; i < texts.length; i += CHUNK) {
      const slice = texts.slice(i, i + CHUNK);
      out.push(...(await this.translate.translateBatch(slice, targetLanguage, sourceLanguage)));
    }
    return out;
  }
}
