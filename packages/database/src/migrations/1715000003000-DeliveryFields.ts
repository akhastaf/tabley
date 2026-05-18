import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeliveryFields1715000003000 implements MigrationInterface {
  name = 'DeliveryFields1715000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN "delivery_address" JSONB NULL,
      ADD COLUMN "delivery_phone" VARCHAR(40) NULL,
      ADD COLUMN "delivery_notes" TEXT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "delivery_address",
      DROP COLUMN IF EXISTS "delivery_phone",
      DROP COLUMN IF EXISTS "delivery_notes";
    `);
  }
}
