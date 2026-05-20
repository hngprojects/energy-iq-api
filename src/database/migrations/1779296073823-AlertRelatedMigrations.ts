import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertRelatedMigrations1779296073823 implements MigrationInterface {
  name = 'AlertRelatedMigrations1779296073823';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "waitlist" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "email" citext NOT NULL, "email_sent" boolean NOT NULL DEFAULT false, "is_subscribed" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_2221cffeeb64bff14201bd5b3de" UNIQUE ("email"), CONSTRAINT "PK_973cfbedc6381485681d6a6916c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "sms_notification" boolean NOT NULL DEFAULT false, "whatsapp_alerts" boolean NOT NULL DEFAULT false, "email_alerts" boolean NOT NULL DEFAULT false, "critical_alerts" boolean NOT NULL, "ai_language" character varying NOT NULL, "quiet_hours_start" character varying(5), "quiet_hours_end" character varying(5), "timezone" character varying(30), "alert_cooldown_minutes" integer NOT NULL DEFAULT '15', "depletion_threshold" integer NOT NULL DEFAULT '10', "channel_quiet_hours" jsonb, "user_id" uuid, CONSTRAINT "REL_4ed056b9344e6f7d8d46ec4b30" UNIQUE ("user_id"), CONSTRAINT "PK_00f004f5922a0744d174530d639" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "email" citext NOT NULL, "password_hash" character varying(255), "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "google_id" character varying(255), "email_verified" boolean NOT NULL DEFAULT false, "inverter_brand" character varying(30), "onboarding_step" smallint, "onboarding_complete" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT false, "last_login_at" TIMESTAMP WITH TIME ZONE, "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "phone_number" character varying(20), "refresh_token_hash" character varying(500), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "inverters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "brand" "public"."inverters_brand_enum" NOT NULL, "model" character varying(255) NOT NULL, "serial_number" character varying(255) NOT NULL, "installation_id" character varying(255), "api_type" "public"."inverters_api_type_enum" NOT NULL, "encrypted_credentials" text, "is_active" boolean NOT NULL DEFAULT true, "is_offline" boolean NOT NULL DEFAULT false, "last_synced_at" TIMESTAMP WITH TIME ZONE, "rated_capacity_kwh" numeric(10,2) NOT NULL DEFAULT '0', "panel_capacity_kw" numeric(5,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_8dc023670abc3138875327fea42" UNIQUE ("serial_number"), CONSTRAINT "PK_256e52026f45115fde7fb14e2fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28ae56bc5bbfbab9a6b3210464" ON "inverters" ("brand", "serial_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_233e641a7c5306e9aa24a82aa3" ON "inverters" ("user_id", "is_active") `,
    );
    await queryRunner.query(
      `CREATE TABLE "inverter_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "inverter_id" uuid NOT NULL, "solar_gen_kw" numeric(10,2) NOT NULL, "battery_soc_percent" numeric(5,2) NOT NULL, "load_kw" numeric(10,2) NOT NULL, "grid_frequency_hz" numeric(5,2), "battery_voltage_v" numeric(10,2), "battery_current_a" numeric(10,2), "grid_voltage_v" numeric(10,2), "naira_saved_ngn" numeric(15,2) NOT NULL DEFAULT '0', "daily_energy_kwh" numeric(10,2), "raw_data" jsonb, "inverter_status" character varying(50), "battery_temperature_c" numeric(5,2), "battery_time_to_go_min" numeric(8,2), "inverter_temperature_c" numeric(5,2), "metric_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_9859fcbfdef784c173ee75a6934" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dd3bcf8fdc5f345eda1e7671d4" ON "inverter_metrics" ("inverter_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "daily_metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "inverter_id" uuid NOT NULL, "date" date NOT NULL, "total_solar_energy_wh" numeric(15,2) NOT NULL DEFAULT '0', "total_ac_output_energy_wh" numeric(15,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_50f7e2d6cbbde644fcff3adf3c4" UNIQUE ("inverter_id", "date"), CONSTRAINT "PK_0b33a3faffa5fbb3d4dad78c4e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_50f7e2d6cbbde644fcff3adf3c" ON "daily_metrics" ("inverter_id", "date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "context_length" integer, "expiration_timeout_seconds" integer, "is_active" boolean NOT NULL DEFAULT true, "is_archived" boolean NOT NULL DEFAULT false, "last_message_timestamp" TIMESTAMP WITH TIME ZONE, "last_message_preview" character varying(200), "room_id" character varying(50), "user_id" uuid NOT NULL, CONSTRAINT "PK_0117647b3c4a4e5ff198aeb6206" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "content" text NOT NULL DEFAULT '', "content_type" character varying(40) NOT NULL, "delivery_status" character varying(40) NOT NULL, "is_transitioning" boolean NOT NULL DEFAULT false, "sender_id" character varying(50) NOT NULL, "chat_id" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "type" character varying(255) NOT NULL, "platform" character varying(50) NOT NULL, "severity" "public"."alerts_severity_enum" NOT NULL, "message" character varying(1024) NOT NULL, "resolution_status" character varying(50), "triggered_at" TIMESTAMP WITH TIME ZONE NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "delivery_processing_status" character varying(255) NOT NULL DEFAULT 'PENDING', "deliverable" boolean NOT NULL DEFAULT true, "delivery_status" character varying(50) NOT NULL DEFAULT 'pending', "delivery_channel" character varying(50), "quiet_hours_deferred_until" TIMESTAMP WITH TIME ZONE, "cooldown_expires_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD CONSTRAINT "FK_4ed056b9344e6f7d8d46ec4b302" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverters" ADD CONSTRAINT "FK_7e7dc9572076d05e7599f5fc4ae" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" ADD CONSTRAINT "FK_cd66337ed18480287071464ab23" FOREIGN KEY ("inverter_id") REFERENCES "inverters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_metrics" ADD CONSTRAINT "FK_25013b61db327b6629e194da1b1" FOREIGN KEY ("inverter_id") REFERENCES "inverters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_7540635fef1922f0b156b9ef74f" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_7540635fef1922f0b156b9ef74f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "daily_metrics" DROP CONSTRAINT "FK_25013b61db327b6629e194da1b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverter_metrics" DROP CONSTRAINT "FK_cd66337ed18480287071464ab23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inverters" DROP CONSTRAINT "FK_7e7dc9572076d05e7599f5fc4ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP CONSTRAINT "FK_4ed056b9344e6f7d8d46ec4b302"`,
    );
    await queryRunner.query(`DROP TABLE "alerts"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "chats"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_50f7e2d6cbbde644fcff3adf3c"`,
    );
    await queryRunner.query(`DROP TABLE "daily_metrics"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dd3bcf8fdc5f345eda1e7671d4"`,
    );
    await queryRunner.query(`DROP TABLE "inverter_metrics"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_233e641a7c5306e9aa24a82aa3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28ae56bc5bbfbab9a6b3210464"`,
    );
    await queryRunner.query(`DROP TABLE "inverters"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(`DROP TABLE "waitlist"`);
  }
}
