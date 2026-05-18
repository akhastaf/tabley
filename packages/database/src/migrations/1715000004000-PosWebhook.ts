import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosWebhook1715000004000 implements MigrationInterface {
  name = 'PosWebhook1715000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN "pos_webhook_url" VARCHAR(2048) NULL,
      ADD COLUMN "pos_webhook_secret" VARCHAR(128) NULL,
      ADD COLUMN "pos_webhook_enabled" BOOLEAN NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      DROP COLUMN IF EXISTS "pos_webhook_url",
      DROP COLUMN IF EXISTS "pos_webhook_secret",
      DROP COLUMN IF EXISTS "pos_webhook_enabled";
    `);
  }
}
