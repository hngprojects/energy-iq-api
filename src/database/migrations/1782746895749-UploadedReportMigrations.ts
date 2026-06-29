import { MigrationInterface, QueryRunner } from 'typeorm';

export class UploadedReportMigrations1782746895749 implements MigrationInterface {
  name = 'UploadedReportMigrations1782746895749';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "uploaded-reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "file_extname" character varying(10) NOT NULL, "filename" character varying(255), "filesize_bytes" bigint NOT NULL, "mime_type" character varying(255), "cloudinary_public_id" character varying(255) NOT NULL, "cloudinary_url" text NOT NULL, "thumbnail_url" text NOT NULL, "format" character varying(50), "resource_type" character varying(50) NOT NULL DEFAULT 'image', "version" integer, "metadata" jsonb, "report_id" uuid NOT NULL, "user_id" uuid NOT NULL, "share_token" uuid NOT NULL DEFAULT gen_random_uuid(), "shareable_link_expires_at" TIMESTAMP WITH TIME ZONE, "delete_job_id" uuid, "download_count" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_894c759edf5b3379105dcab3e1f" UNIQUE ("report_id"), CONSTRAINT "UQ_f201e40cca9916225a7dd634253" UNIQUE ("share_token"), CONSTRAINT "PK_96fc5e2e3ad7a0f5d11c11e0355" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-reports" ADD CONSTRAINT "FK_894c759edf5b3379105dcab3e1f" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-reports" ADD CONSTRAINT "FK_2c1a5fb3865f092a8032153962f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded-reports" DROP CONSTRAINT "FK_2c1a5fb3865f092a8032153962f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-reports" DROP CONSTRAINT "FK_894c759edf5b3379105dcab3e1f"`,
    );
    await queryRunner.query(`DROP TABLE "uploaded-reports"`);
  }
}
