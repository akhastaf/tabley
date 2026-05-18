import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategoryEntity, MenuItemEntity, TenantEntity } from '@tabley/database';
import { SearchSync } from '../search/search.sync';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategoryEntity)
    private readonly categories: Repository<MenuCategoryEntity>,
    @InjectRepository(MenuItemEntity) private readonly items: Repository<MenuItemEntity>,
    @InjectRepository(TenantEntity) private readonly tenants: Repository<TenantEntity>,
    private readonly searchSync: SearchSync,
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
      available: input.available ?? true,
      position: input.position ?? 0,
    });
    const saved = await this.items.save(entity);
    await this.searchSync.syncMenuItemById(saved.id);
    return saved;
  }

  async deleteItem(tenantId: string, id: string) {
    const row = await this.items.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Not found' });
    await this.items.remove(row);
    await this.searchSync.deleteMenuItem(id);
  }

  async getPublicMenu(slug: string) {
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
    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        locale: tenant.defaultLocale,
        deliveryEnabled: tenant.deliveryEnabled,
      },
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        items: (byCategory.get(c.id) ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          priceCents: i.priceCents,
          imageUrl: i.imageUrl,
          allergens: i.allergens,
        })),
      })),
    };
  }
}
