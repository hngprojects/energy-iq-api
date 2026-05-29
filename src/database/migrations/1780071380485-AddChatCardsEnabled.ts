import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChatCardsEnabled1780071380485 implements MigrationInterface {
    name = 'AddChatCardsEnabled1780071380485'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "chat_cards_enabled" boolean DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "chat_cards_enabled"`);
    }

}
