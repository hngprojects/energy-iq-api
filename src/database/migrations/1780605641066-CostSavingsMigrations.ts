import { MigrationInterface, QueryRunner } from 'typeorm';

export class CostSavingsMigrations1780605641066 implements MigrationInterface {
  name = 'CostSavingsMigrations1780605641066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP COLUMN "naira_saved_ngn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP COLUMN "daily_energy_kwh"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP COLUMN "raw_data"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_settings_generator_fuel_type_enum" AS ENUM('DIESEL', 'PMS')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "generator_fuel_type" "public"."user_settings_generator_fuel_type_enum" NOT NULL DEFAULT 'PMS'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "generator_rated_power_kw" numeric(5)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "generator_rated_power_kw"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "generator_fuel_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."user_settings_generator_fuel_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD "raw_data" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD "daily_energy_kwh" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD "naira_saved_ngn" numeric(15,2) NOT NULL DEFAULT '0'`,
    );
  }
}
