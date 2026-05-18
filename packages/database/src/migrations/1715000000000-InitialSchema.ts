import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1715000000000 implements MigrationInterface {
  name = 'InitialSchema1715000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "slug" VARCHAR(80) NOT NULL,
        "name" VARCHAR(160) NOT NULL,
        "plan" VARCHAR(32) NOT NULL DEFAULT 'free',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "delivery_enabled" BOOLEAN NOT NULL DEFAULT false,
        "default_locale" VARCHAR(8) NOT NULL DEFAULT 'en',
        CONSTRAINT "uq_tenants_slug" UNIQUE ("slug")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "tenant_members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "user_id" VARCHAR(64) NOT NULL,
        "role" VARCHAR(32) NOT NULL,
        "invited_email" VARCHAR(254) NULL,
        CONSTRAINT "uq_tenant_member" UNIQUE ("tenant_id", "user_id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tenant_members_user_id" ON "tenant_members" ("user_id");`);

    await queryRunner.query(`
      CREATE TABLE "restaurant_tables" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "label" VARCHAR(40) NOT NULL,
        "token_hash" VARCHAR(128) NOT NULL,
        "capacity" INTEGER NOT NULL DEFAULT 4,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "uq_table_label" UNIQUE ("tenant_id", "label"),
        CONSTRAINT "uq_table_token_hash" UNIQUE ("token_hash")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "menu_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" VARCHAR(80) NOT NULL,
        "position" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_menu_categories_tenant_position" ON "menu_categories" ("tenant_id", "position");`);

    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "category_id" uuid NOT NULL REFERENCES "menu_categories"("id") ON DELETE CASCADE,
        "name" VARCHAR(120) NOT NULL,
        "description" TEXT NULL,
        "price_cents" INTEGER NOT NULL,
        "image_url" VARCHAR(1024) NULL,
        "allergens" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "available" BOOLEAN NOT NULL DEFAULT true,
        "position" INTEGER NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_menu_items_tenant_category" ON "menu_items" ("tenant_id", "category_id");`);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "table_id" uuid NULL REFERENCES "restaurant_tables"("id") ON DELETE SET NULL,
        "customer_user_id" VARCHAR(64) NULL,
        "guest_session_id" VARCHAR(64) NULL,
        "status" VARCHAR(32) NOT NULL,
        "channel" VARCHAR(16) NOT NULL,
        "total_cents" INTEGER NOT NULL DEFAULT 0,
        "customer_note" TEXT NULL,
        "confirmed_by_user_id" VARCHAR(64) NULL,
        "confirmed_at" TIMESTAMPTZ NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_orders_tenant_status" ON "orders" ("tenant_id", "status");`);
    await queryRunner.query(`CREATE INDEX "idx_orders_table" ON "orders" ("table_id");`);

    await queryRunner.query(`
      CREATE TABLE "order_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "menu_item_id" uuid NOT NULL,
        "item_name_snapshot" VARCHAR(120) NOT NULL,
        "unit_price_cents" INTEGER NOT NULL,
        "quantity" INTEGER NOT NULL,
        "note" TEXT NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_order_lines_order" ON "order_lines" ("order_id");`);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "method" VARCHAR(16) NOT NULL,
        "status" VARCHAR(16) NOT NULL,
        "amount_cents" INTEGER NOT NULL,
        "provider_ref" VARCHAR(128) NULL,
        "captured_at" TIMESTAMPTZ NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_payments_order" ON "payments" ("order_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_lines";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_items";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_tables";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_members";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenants";`);
  }
}
