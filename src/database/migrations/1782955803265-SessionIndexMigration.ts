import { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionIndexMigration1782955803265 implements MigrationInterface {
  name = 'SessionIndexMigration1782955803265';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_e9658e959c490b0a634dfc5478" ON "user_sessions" ("user_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e9658e959c490b0a634dfc5478"`,
    );
  }
}
