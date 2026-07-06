import { MigrationInterface, QueryRunner } from "typeorm";

export class ResolvedTeamAccessMigrations1783322757456 implements MigrationInterface {
    name = 'ResolvedTeamAccessMigrations1783322757456'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_53b510b4a64c476f27a943d0ea"`);
        await queryRunner.query(`ALTER TYPE "public"."inverter_members_role_enum" RENAME TO "inverter_members_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."inverter_members_role_enum" AS ENUM('inverter_owner', 'inverter_admin', 'inverter_technician', 'inverter_viewer')`);
        await queryRunner.query(`ALTER TABLE "inverter_members" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "inverter_members" ALTER COLUMN "role" TYPE "public"."inverter_members_role_enum" USING "role"::"text"::"public"."inverter_members_role_enum"`);
        await queryRunner.query(`ALTER TABLE "inverter_members" ALTER COLUMN "role" SET DEFAULT 'inverter_viewer'`);
        await queryRunner.query(`DROP TYPE "public"."inverter_members_role_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_307d33f2236732c3831616d355" ON "inverter_members" ("inverter_id", "email") WHERE "status" != deactivated`);
        await queryRunner.query(`ALTER TABLE "inverter_members" ADD CONSTRAINT "FK_a626669cf750724d142ccc06145" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "inverter_members" DROP CONSTRAINT "FK_a626669cf750724d142ccc06145"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_307d33f2236732c3831616d355"`);
        await queryRunner.query(`CREATE TYPE "public"."inverter_members_role_enum_old" AS ENUM('inverter_admin', 'inverter_technician', 'inverter_viewer')`);
        await queryRunner.query(`ALTER TABLE "inverter_members" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "inverter_members" ALTER COLUMN "role" TYPE "public"."inverter_members_role_enum_old" USING "role"::"text"::"public"."inverter_members_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "inverter_members" ALTER COLUMN "role" SET DEFAULT 'inverter_viewer'`);
        await queryRunner.query(`DROP TYPE "public"."inverter_members_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."inverter_members_role_enum_old" RENAME TO "inverter_members_role_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_53b510b4a64c476f27a943d0ea" ON "inverter_members" ("inverter_id", "email") `);
    }

}
