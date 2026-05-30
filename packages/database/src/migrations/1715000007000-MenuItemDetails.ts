import { MigrationInterface, QueryRunner } from 'typeorm';

export class MenuItemDetails1715000007000 implements MigrationInterface {
  name = 'MenuItemDetails1715000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN "labels" jsonb NOT NULL DEFAULT '[]'::jsonb;`,
    );
    await queryRunner.query(
      `ALTER TABLE "menu_items" ADD COLUMN "nutrition" jsonb NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "nutrition";`);
    await queryRunner.query(`ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "labels";`);
  }
}
