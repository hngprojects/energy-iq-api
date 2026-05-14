import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterInverterAndMetricsTable1778688495238 implements MigrationInterface {
  name = 'AlterInverterAndMetricsTable1778688495238';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create daily_metrics table
    await queryRunner.query(
      `CREATE TABLE "daily_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50f7e2d6cbbde644fcff3adf3c" ON "daily_metrics" ("inverter_id", "date") `,
    );

    // Add new columns to inverter_metrics
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD "inverter_status" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD "battery_temperature_c" numeric(5,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD "battery_time_to_go_min" numeric(8,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD "inverter_temperature_c" numeric(5,2)`,
    );

    // Foreign key for daily_metrics → inverters
    await queryRunner.query(
      `ALTER TABLE "daily_metrics" ADD CONSTRAINT "FK_25013b61db327b6629e194da1b1" FOREIGN KEY ("inverter_id") REFERENCES "inverters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "daily_metrics" DROP CONSTRAINT "FK_25013b61db327b6629e194da1b1"`,
    );

    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP COLUMN "inverter_temperature_c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP COLUMN "battery_time_to_go_min"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP COLUMN "battery_temperature_c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP COLUMN "inverter_status"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_50f7e2d6cbbde644fcff3adf3c"`,
    );
    await queryRunner.query(`DROP TABLE "daily_metrics"`);
  }
}
