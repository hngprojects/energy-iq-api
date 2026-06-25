import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleReportMigration1782362372492 implements MigrationInterface {
  name = 'ScheduleReportMigration1782362372492';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reports" ADD "series_id" uuid`);
    await queryRunner.query(`ALTER TABLE "reports" ADD "occurrence" smallint`);
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "recurring" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "UQ_3bf5911319efd71c7cd1e2d5db1" UNIQUE ("series_id", "occurrence")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "UQ_3bf5911319efd71c7cd1e2d5db1"`,
    );
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "recurring"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "occurrence"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "series_id"`);
  }
}
