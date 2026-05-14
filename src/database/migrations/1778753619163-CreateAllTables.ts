import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAllTables1778753619163 implements MigrationInterface {
  name = 'CreateAllTables1778753619163';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "email" citext NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "onboarding_complete" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "onboarding_complete" SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "is_active" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28ae56bc5bbfbab9a6b3210464"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."inverters_brand_enum" RENAME TO "inverters_brand_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inverters_brand_enum" AS ENUM('VICTRON', 'GROWATT', 'SUNSYNK', 'DEYE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverters" ALTER COLUMN "brand" TYPE "public"."inverters_brand_enum" USING "brand"::"text"::"public"."inverters_brand_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."inverters_brand_enum_old"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_28ae56bc5bbfbab9a6b3210464" ON "inverters" ("brand", "serial_number") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28ae56bc5bbfbab9a6b3210464"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."inverters_brand_enum_old" AS ENUM('VICTRON', 'GROWATT', 'SUNSYNK')`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverters" ALTER COLUMN "brand" TYPE "public"."inverters_brand_enum_old" USING "brand"::"text"::"public"."inverters_brand_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."inverters_brand_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."inverters_brand_enum_old" RENAME TO "inverters_brand_enum"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28ae56bc5bbfbab9a6b3210464" ON "inverters" ("brand", "serial_number") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "is_active" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "onboarding_complete" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "onboarding_complete" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email_verified" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
  }
}
