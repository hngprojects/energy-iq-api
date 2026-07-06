import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamAccessMigrations1783253053865 implements MigrationInterface {
  name = 'TeamAccessMigrations1783253053865';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."inverter_members_role_enum" AS ENUM('inverter_admin', 'inverter_technician', 'inverter_viewer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inverter_members_status_enum" AS ENUM('invited', 'active', 'deactivated')`,
    );
    await queryRunner.query(
      `CREATE TABLE "inverter_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "inverter_id" uuid NOT NULL, "user_id" uuid, "email" citext NOT NULL, "role" "public"."inverter_members_role_enum" NOT NULL DEFAULT 'inverter_viewer', "status" "public"."inverter_members_status_enum" NOT NULL DEFAULT 'invited', "invited_by_id" uuid NOT NULL, "invite_token" uuid NOT NULL, "invite_token_expires_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f583b9fff8a7c4fc106c373ad50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53817b328dbebf87b3ae658581" ON "inverter_members" ("invite_token", "email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_53b510b4a64c476f27a943d0ea" ON "inverter_members" ("inverter_id", "email") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_invited_user" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_members" ADD CONSTRAINT "FK_0674823f9010facff1ebc3ecb6c" FOREIGN KEY ("inverter_id") REFERENCES "inverters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_members" ADD CONSTRAINT "FK_74c62d069bfd4c6d43bea2490fa" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inverter_members" DROP CONSTRAINT "FK_74c62d069bfd4c6d43bea2490fa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_members" DROP CONSTRAINT "FK_0674823f9010facff1ebc3ecb6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "is_invited_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_53b510b4a64c476f27a943d0ea"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_53817b328dbebf87b3ae658581"`,
    );
    await queryRunner.query(`DROP TABLE "inverter_members"`);
    await queryRunner.query(
      `DROP TYPE "public"."inverter_members_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."inverter_members_role_enum"`);
  }
}
