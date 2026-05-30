// Reindex menu items into Meilisearch for one tenant (slug arg) or all tenants.
// Self-contained: builds its own DataSource + Meili client so it can run without
// bootstrapping the full Nest app. Mirrors SearchSync's document shape.
//   node dist/scripts/reindex-search.js [tenantSlug]
import { DataSource } from 'typeorm';
import { MeiliSearch } from 'meilisearch';
import {
  TenantEntity,
  MenuCategoryEntity,
  MenuItemEntity,
} from '@tabley/database';

const INDEX = 'menu_items';

async function main() {
  const slugArg = process.argv[2];

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [TenantEntity, MenuCategoryEntity, MenuItemEntity],
    synchronize: false,
  });
  await ds.initialize();

  const host = process.env.MEILI_HOST;
  if (!host) throw new Error('MEILI_HOST not set');
  const client = new MeiliSearch({ host, apiKey: process.env.MEILI_MASTER_KEY });

  const tenants = await ds.getRepository(TenantEntity).find(
    slugArg ? { where: { slug: slugArg } } : undefined,
  );
  if (tenants.length === 0) {
    console.error(slugArg ? `No tenant with slug ${slugArg}` : 'No tenants found');
    process.exit(1);
  }

  const index = client.index(INDEX);

  for (const tenant of tenants) {
    const categories = await ds
      .getRepository(MenuCategoryEntity)
      .find({ where: { tenantId: tenant.id } });
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const items = await ds
      .getRepository(MenuItemEntity)
      .find({ where: { tenantId: tenant.id } });

    // Clear any stale docs for this tenant, then push fresh ones.
    const del = await index.deleteDocuments({ filter: `tenantId = "${tenant.id}"` });
    await client.waitForTask(del.taskUid);

    const docs = items.map((i) => ({
      id: i.id,
      tenantId: i.tenantId,
      tenantSlug: tenant.slug,
      categoryId: i.categoryId,
      categoryName: categoryById.get(i.categoryId)?.name ?? '',
      name: i.name,
      description: i.description ?? '',
      priceCents: i.priceCents,
      allergens: i.allergens ?? [],
      labels: i.labels ?? [],
      translationsText: Object.values(i.translations ?? {})
        .flatMap((tr) => [tr?.name, tr?.description])
        .filter(Boolean)
        .join(' '),
      available: i.available,
      position: i.position,
      updatedAtTs: Math.floor(new Date(i.updatedAt).getTime() / 1000),
    }));

    if (docs.length > 0) {
      const task = await index.addDocuments(docs);
      await client.waitForTask(task.taskUid);
    }
    console.log(`reindexed ${docs.length} items for ${tenant.slug} (${tenant.id})`);
  }

  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
