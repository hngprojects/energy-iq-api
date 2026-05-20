import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSandboxBrandEnum1779273000000 implements MigrationInterface {
  name = 'AddSandboxBrandEnum1779273000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ADD VALUE is idempotent-safe via DO block — no error if value already exists
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."inverters_brand_enum" ADD VALUE 'SANDBOX';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing enum values directly.
    // To roll back: recreate the enum without SANDBOX and migrate the column.
    // This is intentionally left as a no-op since removing enum values
    // requires a full type recreation and is rarely needed in practice.
  }
}
