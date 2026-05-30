import { MigrationInterface, QueryRunner } from 'typeorm';

export class WaiterZones1715000008000 implements MigrationInterface {
  name = 'WaiterZones1715000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurant_tables" ADD COLUMN "assigned_waiter_id" varchar(64) NULL;`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tables_assigned_waiter" ON "restaurant_tables" ("assigned_waiter_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tables_assigned_waiter";`);
    await queryRunner.query(
      `ALTER TABLE "restaurant_tables" DROP COLUMN IF EXISTS "assigned_waiter_id";`,
    );
  }
}
