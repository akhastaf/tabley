import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuTranslations1715000009000 implements MigrationInterface {
  name = 'MenuTranslations1715000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Per-language overlays for item name/description, keyed by language code.
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN "translations" jsonb NOT NULL DEFAULT '{}'::jsonb;`,
    );
    // Per-language overlay for category name.
    await queryRunner.query(
      `ALTER TABLE "menu_categories" ADD COLUMN "translations" jsonb NOT NULL DEFAULT '{}'::jsonb;`,
    );
    // The set of languages a restaurant offers, as [{ code, name }]. The base
    // content stays in the existing columns (tenant.default_locale language).
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN "menu_languages" jsonb NOT NULL DEFAULT '[]'::jsonb;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "menu_languages";`);
    await queryRunner.query(`ALTER TABLE "menu_categories" DROP COLUMN IF EXISTS "translations";`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "translations";`);
  }
}
