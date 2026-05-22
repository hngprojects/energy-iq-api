import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPersonalSettings1779473796381 implements MigrationInterface {
    name = 'AddUserPersonalSettings1779473796381'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "business_name" character varying`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "business_type" character varying`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "state" character varying`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "city" character varying`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "sms_notification" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "whatsapp_alerts" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "email_alerts" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "critical_alerts" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "critical_alerts" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "ai_language" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "alert_cooldown_minutes" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "depletion_threshold" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "depletion_threshold" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "alert_cooldown_minutes" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "ai_language" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "critical_alerts" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "critical_alerts" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "email_alerts" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "whatsapp_alerts" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "sms_notification" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "state"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "business_type"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "business_name"`);
    }

}
