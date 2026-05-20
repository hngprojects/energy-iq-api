import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSandboxBrandEnum1779273000000 implements MigrationInterface {
  name = 'AddSandboxBrandEnum1779273000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adds 'SANDBOX' to the inverters_brand_enum type.
    // Uses a DO block so it is safe to run on databases that already have the value.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."inverters_brand_enum" ADD VALUE 'SANDBOX';
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing enum values directly.
    // To roll back: recreate the enum without SANDBOX and migrate the column.
    // This is intentionally left as a no-op since removing enum values
    // requires a full type recreation and is rarely needed in practice.
  }
}
