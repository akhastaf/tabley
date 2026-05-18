import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantInvitations1715000002000 implements MigrationInterface {
  name = 'TenantInvitations1715000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenant_invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "email" VARCHAR(254) NOT NULL,
        "role" VARCHAR(32) NOT NULL,
        "token" VARCHAR(64) NOT NULL,
        "status" VARCHAR(16) NOT NULL,
        "invited_by_user_id" VARCHAR(64) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "accepted_at" TIMESTAMPTZ NULL,
        "accepted_by_user_id" VARCHAR(64) NULL,
        CONSTRAINT "uq_tenant_invitations_token" UNIQUE ("token")
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_tenant_invitations_email" ON "tenant_invitations" ("email");`);
    await queryRunner.query(`CREATE INDEX "idx_tenant_invitations_status" ON "tenant_invitations" ("status");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_invitations";`);
  }
}
