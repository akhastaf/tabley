import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds public restaurant information to tenants: address (single line + city /
 * postal / country), contact channels (phone, email, website), geo (lat/lng for
 * the map preview), IANA timezone, and the weekly opening-hours JSON used to
 * decide whether the restaurant is currently open. All columns are nullable so
 * the change is fully backward compatible with seeded tenants.
 */
export class TenantInfo1715000011000 implements MigrationInterface {
  name = 'TenantInfo1715000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants"
      ADD COLUMN "address_line" varchar(255),
      ADD COLUMN "city" varchar(120),
      ADD COLUMN "postal_code" varchar(20),
      ADD COLUMN "country" varchar(80),
      ADD COLUMN "phone" varchar(40),
      ADD COLUMN "email" varchar(255),
      ADD COLUMN "website_url" varchar(2048),
      ADD COLUMN "latitude" numeric(9,6),
      ADD COLUMN "longitude" numeric(9,6),
      ADD COLUMN "timezone" varchar(64),
      ADD COLUMN "opening_hours" jsonb;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "opening_hours",
      DROP COLUMN IF EXISTS "timezone",
      DROP COLUMN IF EXISTS "longitude",
      DROP COLUMN IF EXISTS "latitude",
      DROP COLUMN IF EXISTS "website_url",
      DROP COLUMN IF EXISTS "email",
      DROP COLUMN IF EXISTS "phone",
      DROP COLUMN IF EXISTS "country",
      DROP COLUMN IF EXISTS "postal_code",
      DROP COLUMN IF EXISTS "city",
      DROP COLUMN IF EXISTS "address_line";`);
  }
}
