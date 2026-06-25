import { MigrationInterface, QueryRunner } from "typeorm";

export class CancelReportsMigration1782373466676 implements MigrationInterface {
    name = 'CancelReportsMigration1782373466676'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."reports_status_enum" RENAME TO "reports_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."reports_status_enum" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "status" TYPE "public"."reports_status_enum" USING "status"::"text"::"public"."reports_status_enum"`);
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."reports_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."reports_status_enum_old" AS ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED')`);
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "status" TYPE "public"."reports_status_enum_old" USING "status"::"text"::"public"."reports_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "reports" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."reports_status_enum_old" RENAME TO "reports_status_enum"`);
    }

}
