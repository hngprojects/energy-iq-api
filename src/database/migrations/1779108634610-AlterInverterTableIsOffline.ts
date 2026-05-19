import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterInverterTableIsOffline1779108634610 implements MigrationInterface {
  name = 'AlterInverterTableIsOffline1779108634610';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inverters" ADD "is_offline" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inverters" DROP COLUMN "is_offline"`);
  }
}
