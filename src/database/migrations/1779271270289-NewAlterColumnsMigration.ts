import { MigrationInterface, QueryRunner } from 'typeorm';

export class NewAlterColumnsMigration1779271270289 implements MigrationInterface {
  name = 'NewAlterColumnsMigration1779271270289';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure users table exists (may be missing if prior migrations were skipped)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "email" citext NOT NULL,
        "password_hash" character varying(255),
        "first_name" character varying(255) NOT NULL,
        "last_name" character varying(255) NOT NULL,
        "google_id" character varying(255),
        "email_verified" boolean NOT NULL DEFAULT false,
        "inverter_brand" character varying(30),
        "onboarding_step" smallint,
        "onboarding_complete" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT false,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'user',
        "refresh_token_hash" character varying(500),
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    // Ensure alerts table exists (may be missing if prior migrations were skipped)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "user_id" uuid NOT NULL,
        "type" character varying(255) NOT NULL,
        "platform" character varying(50) NOT NULL,
        "severity" character varying(50) NOT NULL,
        "message" character varying(1024) NOT NULL,
        "resolution_status" character varying(50),
        "triggered_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id")
      )
    `);

    // Create user_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "sms_notification" boolean NOT NULL DEFAULT false,
        "whatsapp_alerts" boolean NOT NULL DEFAULT false,
        "email_alerts" boolean NOT NULL DEFAULT false,
        "critical_alerts" boolean NOT NULL,
        "ai_language" character varying NOT NULL,
        "quiet_hours_start" character varying(5),
        "quiet_hours_end" character varying(5),
        "timezone" character varying(30),
        "alert_cooldown_minutes" integer NOT NULL DEFAULT '15',
        "depletion_threshold" integer NOT NULL DEFAULT '10',
        "channel_quiet_hours" jsonb,
        "user_id" uuid,
        CONSTRAINT "REL_4ed056b9344e6f7d8d46ec4b30" UNIQUE ("user_id"),
        CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY ("id")
      )
    `);

    // Add phone_number to users if not already there
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" character varying(20)
    `);

    // Add new columns to alerts if not already there
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "delivery_processing_status" character varying(255) NOT NULL DEFAULT 'PENDING'`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "deliverable" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "delivery_status" character varying(50) NOT NULL DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "delivery_channel" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "quiet_hours_deferred_until" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "cooldown_expires_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "metadata" jsonb`);

    // Migrate alerts.severity from varchar to enum (only if it's still a varchar)
    const severityIsVarchar = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'alerts'
        AND column_name = 'severity'
        AND data_type = 'character varying'
    `);
    if (severityIsVarchar.length > 0) {
      await queryRunner.query(`CREATE TYPE "public"."alerts_severity_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'WARNING', 'CRITICAL', 'NONE')`);
      await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "severity"`);
      await queryRunner.query(`ALTER TABLE "alerts" ADD "severity" "public"."alerts_severity_enum" NOT NULL`);
    }

    // Add FK for user_settings -> users (ignore if already exists)
    await queryRunner.query(`DO $$ BEGIN
      ALTER TABLE "user_settings" ADD CONSTRAINT "FK_4ed056b9344e6f7d8d46ec4b302"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_settings" DROP CONSTRAINT IF EXISTS "FK_4ed056b9344e6f7d8d46ec4b302"`);
    // Revert severity enum back to varchar if it was changed
    const severityIsEnum = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'alerts'
        AND column_name = 'severity'
        AND udt_name = 'alerts_severity_enum'
    `);
    if (severityIsEnum.length > 0) {
      await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN "severity"`);
      await queryRunner.query(`DROP TYPE IF EXISTS "public"."alerts_severity_enum"`);
      await queryRunner.query(`ALTER TABLE "alerts" ADD "severity" character varying(50) NOT NULL`);
    }
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "metadata"`);
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "cooldown_expires_at"`);
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "quiet_hours_deferred_until"`);
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "delivery_channel"`);
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "delivery_status"`);
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "deliverable"`);
    await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "delivery_processing_status"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_number"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_settings"`);
  }
}
