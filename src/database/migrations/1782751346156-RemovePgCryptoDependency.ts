import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePgCryptoDependency1782751346156 implements MigrationInterface {
  name = 'RemovePgCryptoDependency1782751346156';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded-reports" ALTER COLUMN "share_token" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded-reports" ALTER COLUMN "share_token" SET DEFAULT uuid_generate_v4()`,
    );
  }
}
