import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Index, MeiliSearch } from 'meilisearch';

export const MENU_ITEMS_INDEX = 'menu_items';

export interface MenuItemDoc {
  id: string;
  tenantId: string;
  tenantSlug: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  priceCents: number;
  allergens: string[];
  labels: string[];
  // Flattened translated name/description across all menu languages, so a
  // customer searching in any offered language still matches the item.
  translationsText: string;
  available: boolean;
  position: number;
  updatedAtTs: number;
}

export interface SearchOptions {
  tenantId: string;
  q: string;
  onlyAvailable?: boolean;
  limit?: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: MeiliSearch | null;
  private readonly enabled: boolean;

  constructor() {
    const host = process.env.MEILI_HOST;
    const apiKey = process.env.MEILI_MASTER_KEY;
    if (!host) {
      this.client = null;
      this.enabled = false;
      this.logger.warn('MEILI_HOST not set — search is disabled');
    } else {
      this.client = new MeiliSearch({ host, apiKey });
      this.enabled = true;
    }
  }

  async onModuleInit() {
    if (!this.client) return;
    try {
      await this.ensureIndex();
    } catch (err) {
      this.logger.warn(`could not configure ${MENU_ITEMS_INDEX} index: ${(err as Error).message}`);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  private menuItemsIndex(): Index<MenuItemDoc> {
    if (!this.client) throw new Error('Search is not configured');
    return this.client.index<MenuItemDoc>(MENU_ITEMS_INDEX);
  }

  private async ensureIndex() {
    if (!this.client) return;
    const indexes = await this.client.getIndexes({ limit: 100 });
    const exists = indexes.results.find((i) => i.uid === MENU_ITEMS_INDEX);
    if (!exists) {
      const task = await this.client.createIndex(MENU_ITEMS_INDEX, { primaryKey: 'id' });
      await this.client.waitForTask(task.taskUid);
      this.logger.log(`created index ${MENU_ITEMS_INDEX}`);
    }
    const idx = this.menuItemsIndex();
    await idx.updateFilterableAttributes(['tenantId', 'tenantSlug', 'available', 'categoryId']);
    await idx.updateSearchableAttributes([
      'name',
      'description',
      'categoryName',
      'allergens',
      'labels',
      'translationsText',
    ]);
    await idx.updateSortableAttributes(['position', 'priceCents', 'updatedAtTs']);
  }

  async upsertMenuItem(doc: MenuItemDoc): Promise<void> {
    if (!this.client) return;
    try {
      await this.menuItemsIndex().addDocuments([doc]);
    } catch (err) {
      this.logger.warn(`upsert failed for menu item ${doc.id}: ${(err as Error).message}`);
    }
  }

  async upsertManyMenuItems(docs: MenuItemDoc[]): Promise<void> {
    if (!this.client || docs.length === 0) return;
    try {
      await this.menuItemsIndex().addDocuments(docs);
    } catch (err) {
      this.logger.warn(`bulk upsert failed (${docs.length}): ${(err as Error).message}`);
    }
  }

  async deleteMenuItem(id: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.menuItemsIndex().deleteDocument(id);
    } catch (err) {
      this.logger.warn(`delete failed for menu item ${id}: ${(err as Error).message}`);
    }
  }

  async deleteMenuItemsForTenant(tenantId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.menuItemsIndex().deleteDocuments({
        filter: `tenantId = "${tenantId}"`,
      });
    } catch (err) {
      this.logger.warn(`tenant wipe failed (${tenantId}): ${(err as Error).message}`);
    }
  }

  async search(opts: SearchOptions) {
    if (!this.client) return { hits: [], totalHits: 0 };
    const filters = [`tenantId = "${opts.tenantId}"`];
    if (opts.onlyAvailable) filters.push('available = true');
    const res = await this.menuItemsIndex().search(opts.q, {
      filter: filters.join(' AND '),
      limit: opts.limit ?? 25,
      attributesToHighlight: ['name', 'description'],
    });
    return {
      hits: res.hits,
      totalHits: res.estimatedTotalHits ?? res.hits.length,
      processingTimeMs: res.processingTimeMs,
    };
  }
}
