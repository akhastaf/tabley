// Seed the "mamma-mia" tenant with a real menu (scraped from the Mamma Mia
// restaurant in Marrakech), a set of tables, and a few waiter accounts with
// example zone assignments. For local testing only.
//
// Usage: pnpm --filter @tabley/api seed:mammamia
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  TenantEntity,
  MenuCategoryEntity,
  MenuItemEntity,
  RestaurantTableEntity,
  TenantMemberEntity,
} from '@tabley/database';
import { UserRole } from '@tabley/shared';
import { auth } from '../auth/auth';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// A standalone DataSource for this script — the package's AppDataSource lives
// behind a subpath export the api's classic module resolution can't type, and
// these entities have no relations, so registering just the five we touch is
// safe.
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    TenantEntity,
    MenuCategoryEntity,
    MenuItemEntity,
    RestaurantTableEntity,
    TenantMemberEntity,
  ],
  synchronize: false,
});

const SLUG = 'mamma-mia';
const TENANT_NAME = 'Mamma Mia';
const TABLE_COUNT = 10;
const WAITER_PASSWORD = 'Password123!';

interface MenuItem {
  name: string;
  description?: string;
  priceCents: number;
}
interface MenuCat {
  name: string;
  items: MenuItem[];
}

const MENU: MenuCat[] = [
  {
    name: 'Entrées',
    items: [
      { name: 'Assortiment De Légumes Grillés', priceCents: 6500 },
      { name: 'Tomate Mozzarella', priceCents: 9000 },
      { name: 'Avocat Aux Crevettes', description: 'sauce cocktail', priceCents: 12000 },
      { name: 'Crevettes Pil Pil', description: 'piments', priceCents: 12000 },
      { name: 'Assiette De Charcuterie', description: 'coppa, salami, mortadelle, (porc)', priceCents: 14000 },
      { name: 'Carpaccio De Boeuf', priceCents: 12000 },
      { name: 'Salade César', description: 'laitue, croûtons, parmesan, poulet, tomates cerise', priceCents: 11000 },
      { name: 'Salade Fruits De Mer', description: 'moules, calamars, crevettes', priceCents: 12000 },
      { name: 'Bresaola', description: 'parmesan et roquette', priceCents: 14000 },
      { name: 'Bruschetta', description: 'pain grillé, ail, tomates et basilic', priceCents: 6500 },
      { name: 'Jambon De Parme San Daniele 24 Mois', description: '(porc)', priceCents: 13000 },
      { name: 'Salade Italienne', description: 'tomate, oeuf, haricots verts, pomme de terre, concombre, champignons, thon et anchois', priceCents: 12000 },
      { name: 'Assiette De Saumon Fumé', priceCents: 11500 },
      { name: 'Parmiggiana', description: 'gratin d’aubergines au parmesan', priceCents: 9500 },
      { name: 'Palourdes Sautées', description: 'ail, huile, persil', priceCents: 16000 },
      { name: 'Calamars Et Crevettes Frits', description: 'sauce tartare', priceCents: 13000 },
      { name: 'Burrata', priceCents: 13500 },
      { name: 'Salade Oceane', description: 'mesclun, avocat, agrumes, crevettes et saumon fumé', priceCents: 13000 },
      { name: 'Vitello Tonato', description: 'noix de veau de lait sauce au thon', priceCents: 17500 },
    ],
  },
  {
    name: 'Pizzas',
    items: [
      { name: 'Focaccia', priceCents: 3500 },
      { name: 'Margherita', description: 'mozzarella, sauce tomate, basilic', priceCents: 7000 },
      { name: 'Regina', description: 'mozzarella, sauce tomate, jambon, champignons (porc ou hallal)', priceCents: 10500 },
      { name: 'L\'Orientale', description: 'mozzarella, sauce tomate, merguez, poivrons', priceCents: 10500 },
      { name: 'Vegetarienne', description: 'mozzarella, sauce tomate, aubergines, poivrons, courgettes', priceCents: 9000 },
      { name: 'Pescatore', description: 'mozzarella, sauce tomate, moules, crevettes, calamars', priceCents: 11000 },
      { name: 'Napolitaine', description: 'mozzarella, sauce tomate, anchois, cåpres', priceCents: 10000 },
      { name: 'Calzone', description: 'mozzarella, sauce tomate, jambon, oeuf, (porc ou hallal)', priceCents: 10500 },
      { name: 'Nettuno', description: 'thon, sauce tomate, oeuf, cåpres', priceCents: 9000 },
      { name: 'Parma', description: 'creme fraiche, parme, roquette, parmesan, (porc)', priceCents: 14000 },
      { name: 'Quatre Fromages', description: 'sauce tomate', priceCents: 9500 },
      { name: 'Enrico', description: 'mozzarella, sauce tomate, chorizo, poivrons, (porc)', priceCents: 10500 },
      { name: 'Norvegienne', description: 'creme fraiche, mozzarella, saumon fumé', priceCents: 13500 },
      { name: 'Campeone', description: 'mozzarella, sauce tomate, viande hachée', priceCents: 9500 },
      { name: 'Paysanne', description: 'creme fraiche, mozzarella, lardons, champignons, (porc ou hallal)', priceCents: 10500 },
      { name: 'Quatre Saisons', description: 'mozzarella, sauce tomate, dinde, artichauts, champignons', priceCents: 10500 },
      { name: 'Enzo', description: 'mozzarella, sauce tomate, champignons, poulet', priceCents: 9000 },
      { name: 'Vito', description: 'mozzarella, bresaola, roquette, parmesan, creme fraiche', priceCents: 14000 },
      { name: 'Nostra', description: 'boule mozzarella, sauce tomate, tomates cerise, basilic, parmesan', priceCents: 11000 },
      { name: 'Angela', description: 'mozzarella, sauce tomate, charcuteries italiennes, (porc)', priceCents: 14000 },
      { name: 'Tar Tufo', description: 'creme de truffes, creme fraiche et champignons', priceCents: 14000 },
      { name: 'Burrata', description: 'sauce tomate, burrata, roquette et parmesan', priceCents: 16000 },
      { name: 'Pepperoni', description: 'tomate, mozzarella chorizo de boeuf', priceCents: 11000 },
    ],
  },
  {
    name: 'Pates',
    items: [
      { name: 'All\'Arrabbiata', description: 'sauce tomate, piment', priceCents: 9000 },
      { name: 'Ail, Huile D\'Olive Et Piments', priceCents: 9000 },
      { name: 'Carbonara', description: 'crème fraiche, lardons, oeuf, (porc ou hallal)', priceCents: 10500 },
      { name: 'Bolognese', priceCents: 10500 },
      { name: 'Quatre Fromages', priceCents: 9500 },
      { name: 'Pesto', description: 'huile d’olives et basilic', priceCents: 9500 },
      { name: 'Aubergines', description: 'sauce tomate', priceCents: 9500 },
      { name: 'Champignons', description: 'crème fraiche', priceCents: 9500 },
      { name: 'Ravioli Ricotta Et Épinards', priceCents: 12000 },
      { name: 'Tagliatelle Au Saumon Fumé', description: 'crème fraiche', priceCents: 12500 },
      { name: 'Gnocchi Quatre Fromages Ou Bolognese', priceCents: 10500 },
      { name: 'Lasagne', description: 'à la bolognese', priceCents: 12000 },
      { name: 'Penne Poulet Champignons', description: 'crème fraîche, poulet, champignons', priceCents: 12500 },
      { name: 'Gratin De Pates', description: 'crème fraîche, penne, jambon de dinde, champignons, mozzarella et parmesan', priceCents: 12500 },
    ],
  },
  {
    name: 'Viandes',
    items: [
      { name: 'Emincé De Volaille Aux Champignons', priceCents: 14000 },
      { name: 'Filet De Poulet À La Sicilienne', description: 'ail, persil, chapelure', priceCents: 14000 },
      { name: 'Escalope De Veau À La Milanaise', priceCents: 17000 },
      { name: 'Escalope De Veau Aux Champignons', priceCents: 17000 },
      { name: 'Osso Buco À La Milanaise', priceCents: 21000 },
      { name: 'Foie De Veau À La Venitienne', description: 'oignons, vinaigre balsamique', priceCents: 18000 },
      { name: 'Filet De Boeuf 200 G', description: 'sauce au poivre ou quatre fromage', priceCents: 21000 },
      { name: 'Fiorentina', description: 'escalope de veau, mozzarella, jambon de dinde, épinards', priceCents: 16500 },
      { name: 'Escalope De Veau Au Citron', priceCents: 16000 },
      { name: 'Saltimbocca Alla Romana', description: 'escalope de veau, parme et sauge', priceCents: 18500 },
      { name: 'Emince De Filet De Boeuf Aux Champignons', priceCents: 16000 },
    ],
  },
  {
    name: 'Poissons',
    items: [
      { name: 'Pavé De Saumon Grillé', priceCents: 17000 },
      { name: 'Gratin De Fruits De Mer', description: 'crème fraiche, fromage', priceCents: 17000 },
      { name: 'Filet De Loup', description: 'sauce vierge', priceCents: 17500 },
      { name: 'Gambas Grillees', priceCents: 18000 },
      { name: 'Calamars Plancha', priceCents: 18000 },
    ],
  },
  {
    name: 'Nos Spécialités',
    items: [
      { name: 'Risotto À La Crème De Truffes Et Parmesan', priceCents: 18500 },
      { name: 'Spaghetti Aux Palourdes', priceCents: 17500 },
      { name: 'Linguine Fruits De Mer', priceCents: 17500 },
      { name: 'Penne À La Crème De Truffes', description: 'et champignons', priceCents: 17500 },
      { name: 'Risotto Funghi E Gamberetti', description: 'champignons et crevettes', priceCents: 18500 },
      { name: 'Linguine Crevettes Pil Pil', priceCents: 17500 },
      { name: 'Spaghetti Polpete', description: 'boulettes de boeuf sauce et basilic', priceCents: 13000 },
      { name: 'Linguine Aux Gambas', priceCents: 17000 },
    ],
  },
  {
    name: 'Desserts',
    items: [
      { name: 'Assiette De Fromage', priceCents: 11000 },
      { name: 'Tiramisù', priceCents: 7500 },
      { name: 'Pannacotta', priceCents: 5500 },
      { name: 'Crème Caramel', priceCents: 5500 },
      { name: 'Salade De Fruits', priceCents: 5500 },
      { name: 'Mousse Au Chocolat', priceCents: 5500 },
      { name: 'Tarte Tatin Et Boule De Glace Vanille', priceCents: 8500 },
      { name: 'Pizza Luna', description: 'nutella, chantilly', priceCents: 7500 },
      { name: 'Cafe Gourmand', priceCents: 8000 },
    ],
  },
];

const WAITERS = [
  { name: 'Luca Rossi', email: 'luca@mammamia.test' },
  { name: 'Sofia Bianchi', email: 'sofia@mammamia.test' },
  { name: 'Marco Verdi', email: 'marco@mammamia.test' },
];

async function findUserIdByEmail(email: string): Promise<string | null> {
  const rows = await AppDataSource.query<Array<{ id: string }>>(
    'SELECT id FROM "user" WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );
  return rows[0]?.id ?? null;
}

async function ensureWaiterUser(name: string, email: string): Promise<string> {
  const existing = await findUserIdByEmail(email);
  if (existing) return existing;
  try {
    await auth.api.signUpEmail({ body: { email, password: WAITER_PASSWORD, name } });
  } catch (err) {
    // A race or pre-existing account — fall through to the lookup below.
    console.warn(`  signUp for ${email} returned: ${(err as Error).message}`);
  }
  const id = await findUserIdByEmail(email);
  if (!id) throw new Error(`Could not create or find user ${email}`);
  return id;
}

async function main() {
  await AppDataSource.initialize();
  console.log('Connected to database.');

  const tenantRepo = AppDataSource.getRepository(TenantEntity);
  const catRepo = AppDataSource.getRepository(MenuCategoryEntity);
  const itemRepo = AppDataSource.getRepository(MenuItemEntity);
  const tableRepo = AppDataSource.getRepository(RestaurantTableEntity);
  const memberRepo = AppDataSource.getRepository(TenantMemberEntity);

  // 1. Tenant
  let tenant = await tenantRepo.findOne({ where: { slug: SLUG } });
  if (!tenant) {
    tenant = await tenantRepo.save(
      tenantRepo.create({ slug: SLUG, name: TENANT_NAME, plan: 'free', defaultLocale: 'fr' }),
    );
    console.log(`Created tenant ${SLUG} (${tenant.id})`);
  } else {
    console.log(`Using existing tenant ${SLUG} (${tenant.id})`);
  }
  const tenantId = tenant.id;

  // 2. Menu — replace any existing categories/items so this is re-runnable.
  await itemRepo.delete({ tenantId });
  await catRepo.delete({ tenantId });
  let itemCount = 0;
  for (let ci = 0; ci < MENU.length; ci++) {
    const cat = MENU[ci]!;
    const savedCat = await catRepo.save(
      catRepo.create({ tenantId, name: cat.name, position: ci }),
    );
    await itemRepo.save(
      cat.items.map((it, ii) =>
        itemRepo.create({
          tenantId,
          categoryId: savedCat.id,
          name: it.name,
          description: it.description ?? null,
          priceCents: it.priceCents,
          position: ii,
          available: true,
          allergens: [],
          labels: [],
        }),
      ),
    );
    itemCount += cat.items.length;
  }
  console.log(`Seeded ${MENU.length} categories and ${itemCount} menu items.`);

  // 3. Tables T1..T10 (create any that are missing).
  const existingTables = await tableRepo.find({ where: { tenantId } });
  const byLabel = new Map(existingTables.map((t) => [t.label, t]));
  const tables: RestaurantTableEntity[] = [];
  for (let i = 1; i <= TABLE_COUNT; i++) {
    const label = `T${i}`;
    let row = byLabel.get(label);
    if (!row) {
      row = await tableRepo.save(
        tableRepo.create({
          tenantId,
          label,
          capacity: i % 3 === 0 ? 6 : 4,
          tokenHash: randomBytes(16).toString('hex'),
        }),
      );
    }
    tables.push(row);
  }
  console.log(`Ensured ${tables.length} tables (T1..T${TABLE_COUNT}).`);

  // 4. Waiters as real login-capable accounts + tenant members.
  const waiterIds: string[] = [];
  for (const w of WAITERS) {
    const userId = await ensureWaiterUser(w.name, w.email);
    const member = await memberRepo.findOne({ where: { tenantId, userId } });
    if (!member) {
      await memberRepo.save(
        memberRepo.create({ tenantId, userId, role: UserRole.WAITER, invitedEmail: w.email }),
      );
    } else if (member.role !== UserRole.WAITER) {
      member.role = UserRole.WAITER;
      await memberRepo.save(member);
    }
    waiterIds.push(userId);
    console.log(`  waiter ${w.name} <${w.email}> → ${userId}`);
  }

  // 5. Zones: Luca serves T1-T3, Sofia serves T4-T6. T7-T10 stay unassigned
  //    and Marco keeps no zone, so he covers the whole floor.
  const [luca, sofia] = waiterIds;
  const tableByLabel = new Map(tables.map((t) => [t.label, t]));
  const zoneMap: Record<string, string | undefined> = {
    T1: luca, T2: luca, T3: luca,
    T4: sofia, T5: sofia, T6: sofia,
  };
  for (const [label, waiterId] of Object.entries(zoneMap)) {
    const t = tableByLabel.get(label);
    if (t && waiterId) {
      t.assignedWaiterId = waiterId;
      await tableRepo.save(t);
    }
  }
  console.log('Assigned zones: Luca → T1-T3, Sofia → T4-T6, Marco → all (no zone).');

  console.log('\nWaiter logins (password for all): ' + WAITER_PASSWORD);
  for (const w of WAITERS) console.log(`  ${w.email}`);

  await AppDataSource.destroy();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
