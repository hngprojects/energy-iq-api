import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlertTable1778927197796 implements MigrationInterface {
  name = 'CreateAlertTable1778927197796';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // This migration was superseded by 1778937255872-CreateAlertTable which already
    // created the alerts table with is_active. No-op to allow the migration chain to proceed.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: the alerts table is managed by 1778937255872-CreateAlertTable
  }
}
