import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportsMigration1781889874859 implements MigrationInterface {
  name = 'ReportsMigration1781889874859';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "inverter_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_type_enum" AS ENUM('GENERAL', 'SOLAR', 'ALERT', 'COSTS_AND_SAVINGS')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "type" "public"."reports_type_enum" NOT NULL DEFAULT 'GENERAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "name" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_period_enum" AS ENUM('weekly', 'monthly', 'custom')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "period" "public"."reports_period_enum" NOT NULL DEFAULT 'weekly'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "reference_date" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "start_date" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "end_date" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "date_delivered" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_status_enum" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD "status" "public"."reports_status_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "key_metrics" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_680b1077dfa86122fd3524d77d3" FOREIGN KEY ("inverter_id") REFERENCES "inverters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_680b1077dfa86122fd3524d77d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "key_metrics" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN "date_delivered"`,
    );
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "end_date"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "start_date"`);
    await queryRunner.query(
      `ALTER TABLE "reports" DROP COLUMN "reference_date"`,
    );
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "period"`);
    await queryRunner.query(`DROP TYPE "public"."reports_period_enum"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "type"`);
    await queryRunner.query(`DROP TYPE "public"."reports_type_enum"`);
    await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "inverter_id"`);
  }
}
