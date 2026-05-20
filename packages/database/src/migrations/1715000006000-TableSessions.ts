import { MigrationInterface, QueryRunner } from 'typeorm';

export class TableSessions1715000006000 implements MigrationInterface {
  name = 'TableSessions1715000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "table_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "table_id" uuid NOT NULL REFERENCES "restaurant_tables"("id") ON DELETE CASCADE,
        "status" VARCHAR(24) NOT NULL DEFAULT 'active',
        "expires_at" TIMESTAMPTZ NOT NULL,
        "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "closed_at" TIMESTAMPTZ NULL,
        "closed_by_user_id" VARCHAR(64) NULL
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_table_sessions_table_status" ON "table_sessions" ("table_id", "status");`);
    await queryRunner.query(`CREATE INDEX "idx_table_sessions_tenant" ON "table_sessions" ("tenant_id");`);

    await queryRunner.query(`
      CREATE TABLE "table_session_participants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "session_id" uuid NOT NULL REFERENCES "table_sessions"("id") ON DELETE CASCADE,
        "user_id" VARCHAR(64) NULL,
        "device_id" VARCHAR(64) NOT NULL,
        "display_name" VARCHAR(80) NOT NULL,
        "role" VARCHAR(16) NOT NULL,
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "left_at" TIMESTAMPTZ NULL,
        CONSTRAINT "uq_session_device" UNIQUE ("session_id", "device_id")
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_session_participants_session" ON "table_session_participants" ("session_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "table_session_participants";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "table_sessions";`);
  }
}
