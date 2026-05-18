import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosApiKey1715000005000 implements MigrationInterface {
  name = 'PosApiKey1715000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN "pos_api_key" VARCHAR(128) NULL;
    `);
    await queryRunner.query(`CREATE INDEX "idx_tenants_pos_api_key" ON "tenants" ("pos_api_key");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tenants_pos_api_key";`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "pos_api_key";`);
  }
}
