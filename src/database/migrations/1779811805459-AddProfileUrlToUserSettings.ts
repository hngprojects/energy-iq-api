import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileUrlToUserSettings1779811805459 implements MigrationInterface {
  name = 'AddProfileUrlToUserSettings1779811805459';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD "profile_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP COLUMN "profile_url"`,
    );
  }
}