import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimestampIndexOnInvertersMetrics1779433310369 implements MigrationInterface {
  name = 'TimestampIndexOnInvertersMetrics1779433310369';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_6adb11c1e8bd66e3488879f5ca" ON "inverter_metrics" ("inverter_id", "metric_timestamp") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6adb11c1e8bd66e3488879f5ca"`,
    );
  }
}
