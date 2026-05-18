import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuImportJobs1715000001000 implements MigrationInterface {
  name = 'MenuImportJobs1715000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "menu_import_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "created_by_user_id" VARCHAR(64) NOT NULL,
        "source_type" VARCHAR(16) NOT NULL,
        "mime_type" VARCHAR(64) NOT NULL,
        "status" VARCHAR(24) NOT NULL,
        "model_used" VARCHAR(64) NULL,
        "result" JSONB NULL,
        "error_message" TEXT NULL,
        "applied_at" TIMESTAMPTZ NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_menu_import_jobs_tenant_status" ON "menu_import_jobs" ("tenant_id", "status");`);
    await queryRunner.query(`CREATE INDEX "idx_menu_import_jobs_creator" ON "menu_import_jobs" ("created_by_user_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "menu_import_jobs";`);
  }
}
