import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInverterAndInverterMetricsTable1778478328943 implements MigrationInterface {
  name = 'CreateInverterAndInverterMetricsTable1778478328943';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."inverters_brand_enum" AS ENUM('VICTRON', 'GROWATT', 'DEYE', 'SUNSYNK')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inverters_api_type_enum" AS ENUM('LIVE_API')`,
    );
    await queryRunner.query(
      `CREATE TABLE "inverters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28ae56bc5bbfbab9a6b3210464" ON "inverters" ("brand", "serial_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_233e641a7c5306e9aa24a82aa3" ON "inverters" ("user_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE TABLE "inverter_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFA
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dd3bcf8fdc5f345eda1e7671d4" ON "inverter_metrics" ("inverter_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverters" ADD CONSTRAINT "FK_7e7dc9572076d05e7599f5fc4ae" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD CONSTRAINT "FK_cd66337ed18480287071464ab23" FOREIGN KEY ("inverter_id") REFERENCES "inverters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP CONSTRAINT "FK_cd66337ed18480287071464ab23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverters" DROP CONSTRAINT "FK_7e7dc9572076d05e7599f5fc4ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dd3bcf8fdc5f345eda1e7671d4"`,
    );
    await queryRunner.query(`DROP TABLE "inverter_metrics"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_233e641a7c5306e9aa24a82aa3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28ae56bc5bbfbab9a6b3210464"`,
    );
    await queryRunner.query(`DROP TABLE "inverters"`);
    await queryRunner.query(`DROP TYPE "public"."inverters_api_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."inverters_brand_enum"`);
  }
}
