import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  MenuCategoryEntity,
  MenuItemEntity,
  TenantEntity,
} from '@tabley/database';
import type { MenuItemTranslations } from '@tabley/database';
import { MenuItemDoc, SearchService } from './search.service';

/** Concatenate every translated name + description into one searchable blob. */
function flattenTranslations(translations: MenuItemTranslations | null | undefined): string {
  if (!translations) return '';
  const parts: string[] = [];
  for (const tr of Object.values(translations)) {
    if (tr?.name) parts.push(tr.name);
    if (tr?.description) parts.push(tr.description);
  }
  return parts.join(' ');
}

@Injectable()
export class SearchSync {
  private readonly logger = new Logger(SearchSync.name);

  constructor(
    @InjectRepository(MenuItemEntity) private readonly items: Repository<MenuItemEntity>,
    @InjectRepository(MenuCategoryEntity)
    private readonly categories: Repository<MenuCategoryEntity>,
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    private readonly search: SearchService,
  ) {}

  async syncMenuItemById(id: string) {
    if (!this.search.isEnabled()) return;
    const item = await this.items.findOne({ where: { id } });
    if (!item) {
      await this.search.deleteMenuItem(id);
      return;
    }
    await this.syncMenuItems([item]);
  }

  async syncMenuItems(items: MenuItemEntity[]) {
    if (!this.search.isEnabled() || items.length === 0) return;
    const tenantIds = [...new Set(items.map((i) => i.tenantId))];
    const categoryIds = [...new Set(items.map((i) => i.categoryId))];
    const [tenants, categories] = await Promise.all([
      this.tenants.find({ where: { id: In(tenantIds) } }),
      this.categories.find({ where: { id: In(categoryIds) } }),
    ]);
    const tenantById = new Map(tenants.map((t) => [t.id, t]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const docs: MenuItemDoc[] = items.map((i) => ({
      id: i.id,
      tenantId: i.tenantId,
      tenantSlug: tenantById.get(i.tenantId)?.slug ?? '',
      categoryId: i.categoryId,
      categoryName: categoryById.get(i.categoryId)?.name ?? '',
      name: i.name,
      description: i.description ?? '',
      priceCents: i.priceCents,
      allergens: i.allergens ?? [],
      labels: i.labels ?? [],
      translationsText: flattenTranslations(i.translations),
      available: i.available,
      position: i.position,
      updatedAtTs: Math.floor(new Date(i.updatedAt).getTime() / 1000),
    }));
    await this.search.upsertManyMenuItems(docs);
  }

  async reindexTenant(tenantId: string) {
    if (!this.search.isEnabled()) {
      return { reindexed: 0, skipped: true as const };
    }
    await this.search.deleteMenuItemsForTenant(tenantId);
    const items = await this.items.find({ where: { tenantId } });
    await this.syncMenuItems(items);
    this.logger.log(`reindexed ${items.length} menu items for tenant ${tenantId}`);
    return { reindexed: items.length, skipped: false as const };
  }

  async deleteMenuItem(id: string) {
    if (!this.search.isEnabled()) return;
    await this.search.deleteMenuItem(id);
  }
}
