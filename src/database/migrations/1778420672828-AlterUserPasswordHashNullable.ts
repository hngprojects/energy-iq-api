import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterUserPasswordHashNullable1778420672828 implements MigrationInterface {
  name = 'AlterUserPasswordHashNullable1778420672828';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`,
    );
  }
}
