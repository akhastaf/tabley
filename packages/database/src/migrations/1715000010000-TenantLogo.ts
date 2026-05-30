import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantLogo1715000010000 implements MigrationInterface {
  name = 'TenantLogo1715000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD COLUMN "logo_url" varchar(2048);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "logo_url";`);
  }
}
