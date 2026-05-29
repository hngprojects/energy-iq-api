import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTitleToChats1780055532748 implements MigrationInterface {
  name = 'AddTitleToChats1780055532748';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chats" ADD "title" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chats" DROP COLUMN "title"`);
  }
}
