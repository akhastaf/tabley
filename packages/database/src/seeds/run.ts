import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { TenantEntity } from '../entities/tenant.entity';
import { MenuCategoryEntity } from '../entities/menu-category.entity';
import { MenuItemEntity } from '../entities/menu-item.entity';

async function main() {
  await AppDataSource.initialize();
  console.log('Connected to database.');

  await AppDataSource.transaction(async (m) => {
    const tenantRepo = m.getRepository(TenantEntity);
    const categoryRepo = m.getRepository(MenuCategoryEntity);
    const itemRepo = m.getRepository(MenuItemEntity);

    let demo = await tenantRepo.findOne({ where: { slug: 'demo' } });
    if (!demo) {
      demo = tenantRepo.create({
        slug: 'demo',
        name: 'Tabley Demo Cafe',
        plan: 'free',
        deliveryEnabled: true,
        defaultLocale: 'en',
      });
      await tenantRepo.save(demo);
      console.log(`Created demo tenant ${demo.id}`);
    } else {
      console.log(`Demo tenant already exists: ${demo.id}`);
    }

    const existingCategories = await categoryRepo.count({ where: { tenantId: demo.id } });
    if (existingCategories === 0) {
      const coffee = await categoryRepo.save(
        categoryRepo.create({ tenantId: demo.id, name: 'Coffee', position: 0 }),
      );
      const pastries = await categoryRepo.save(
        categoryRepo.create({ tenantId: demo.id, name: 'Pastries', position: 1 }),
      );

      await itemRepo.save([
        itemRepo.create({
          tenantId: demo.id,
          categoryId: coffee.id,
          name: 'Espresso',
          description: 'Single shot, rich and bold',
          priceCents: 250,
          allergens: [],
          position: 0,
        }),
        itemRepo.create({
          tenantId: demo.id,
          categoryId: coffee.id,
          name: 'Cappuccino',
          description: 'Espresso with steamed milk foam',
          priceCents: 380,
          allergens: ['milk'],
          position: 1,
        }),
        itemRepo.create({
          tenantId: demo.id,
          categoryId: pastries.id,
          name: 'Croissant',
          description: 'Flaky butter croissant',
          priceCents: 320,
          allergens: ['gluten', 'milk'],
          position: 0,
        }),
      ]);
      console.log('Seeded demo menu.');
    } else {
      console.log('Demo menu already exists, skipping.');
    }
  });

  console.log('\nNote: the SaaS platform admin user is created via Better Auth signup.');
  console.log('Sign up at the web app with the email from ADMIN_EMAIL and then promote that');
  console.log('user to platform_admin via the /admin bootstrap route or a follow-up SQL update.');

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
