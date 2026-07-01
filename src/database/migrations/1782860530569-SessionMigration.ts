import { MigrationInterface, QueryRunner } from 'typeorm';

export class SessionMigration1782860530569 implements MigrationInterface {
  name = 'SessionMigration1782860530569';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "refresh_token_hash" character varying(500), "device_name" character varying(100), "platform" character varying(20), "device_token" character varying(255), "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "expires_at" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, "ip_address" character varying(45), "user_agent" text, CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "refresh_token_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "refresh_token_hash" character varying(500)`,
    );
    await queryRunner.query(`DROP TABLE "user_sessions"`);
  }
}
