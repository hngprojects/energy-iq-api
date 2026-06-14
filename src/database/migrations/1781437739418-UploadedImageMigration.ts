import { MigrationInterface, QueryRunner } from 'typeorm';

export class UploadedImageMigration1781437739418 implements MigrationInterface {
  name = 'UploadedImageMigration1781437739418';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" DROP COLUMN "filepath"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" DROP COLUMN "page_count"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" ADD "page_count" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" ADD "filepath" text`,
    );
  }
}
