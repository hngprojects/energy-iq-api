import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDbExtensions1778249200000 implements MigrationInterface {
  name = 'CreateDbExtensions1778249200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
  }

  public down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    // Extensions are shared dependencies; avoid dropping them in production.
    return Promise.resolve();
  }
}
