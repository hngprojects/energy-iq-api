import { MigrationInterface, QueryRunner } from "typeorm";

export class AlertRelatedMigrations1779314394192 implements MigrationInterface {
    name = 'AlertRelatedMigrations1779314394192'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "sms_notification" boolean NOT NULL DEFAULT false, "whatsapp_alerts" boolean NOT NULL DEFAULT false, "email_alerts" boolean NOT NULL DEFAULT false, "critical_alerts" boolean NOT NULL, "ai_language" character varying NOT NULL, "quiet_hours_start" character varying(5), "quiet_hours_end" character varying(5), "timezone" character varying(30), "alert_cooldown_minutes" integer NOT NULL DEFAULT '15', "depletion_threshold" integer NOT NULL DEFAULT '10', "channel_quiet_hours" jsonb, "user_id" uuid, CONSTRAINT "REL_4ed056b9344e6f7d8d46ec4b30" UNIQUE ("user_id"), CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_number" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "delivery_processing_status" character varying(255) NOT NULL DEFAULT 'PENDING'`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "deliverable" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "delivery_status" character varying(50) NOT NULL DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "delivery_channel" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "quiet_hours_deferred_until" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "cooldown_expires_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "metadata" jsonb`);
        await queryRunner.query(`DROP INDEX "public"."IDX_28ae56bc5bbfbab9a6b3210464"`);
        await queryRunner.query(`ALTER TYPE "public"."inverters_brand_enum" RENAME TO "inverters_brand_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."inverters_brand_enum" AS ENUM('VICTRON', 'GROWATT', 'SUNSYNK', 'DEYE', 'SANDBOX')`);
        await queryRunner.query(`ALTER TABLE "inverters" ALTER COLUMN "brand" TYPE "public"."inverters_brand_enum" USING "brand"::"text"::"public"."inverters_brand_enum"`);
        await queryRunner.query(`DROP TYPE "public"."inverters_brand_enum_old"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "severity"`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_severity_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'WARNING', 'CRITICAL', 'NONE')`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "severity" "public"."alerts_severity_enum" NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_28ae56bc5bbfbab9a6b3210464" ON "inverters" ("brand", "serial_number") `);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD CONSTRAINT "FK_4ed056b9344e6f7d8d46ec4b302" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" DROP CONSTRAINT "FK_4ed056b9344e6f7d8d46ec4b302"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_28ae56bc5bbfbab9a6b3210464"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "severity"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_severity_enum"`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD "severity" character varying(50) NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."inverters_brand_enum_old" AS ENUM('VICTRON', 'GROWATT', 'SUNSYNK', 'DEYE')`);
        await queryRunner.query(`ALTER TABLE "inverters" ALTER COLUMN "brand" TYPE "public"."inverters_brand_enum_old" USING "brand"::"text"::"public"."inverters_brand_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."inverters_brand_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."inverters_brand_enum_old" RENAME TO "inverters_brand_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_28ae56bc5bbfbab9a6b3210464" ON "inverters" ("brand", "serial_number") `);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "metadata"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "cooldown_expires_at"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "quiet_hours_deferred_until"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "delivery_channel"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "delivery_status"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "deliverable"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "delivery_processing_status"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_number"`);
        await queryRunner.query(`DROP TABLE "user_settings"`);
    }

}
