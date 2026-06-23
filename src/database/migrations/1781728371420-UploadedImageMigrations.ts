import { MigrationInterface, QueryRunner } from 'typeorm';

export class UploadedImageMigrations1781728371420 implements MigrationInterface {
  name = 'UploadedImageMigrations1781728371420';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."uploaded-images_upload_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETE', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "uploaded-images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "file_extname" character varying(10) NOT NULL, "filename" character varying(255), "filesize_bytes" bigint NOT NULL, "public_id" character varying(255) NOT NULL, "upload_status" "public"."uploaded-images_upload_status_enum" NOT NULL DEFAULT 'PENDING', "upload_url" text NOT NULL, "uploaded_by_email" character varying(255) NOT NULL, "thumbnail" text NOT NULL, "user_id" uuid, CONSTRAINT "REL_66105a91f78a99b9a0468fbe98" UNIQUE ("user_id"), CONSTRAINT "PK_4f8eff036504a3a4405701d75a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "key_metrics" jsonb NOT NULL, CONSTRAINT "PK_d9013193989303580053c0b5ef6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" ADD CONSTRAINT "FK_66105a91f78a99b9a0468fbe98d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_ca7a21eb95ca4625bd5eaef7e0c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_ca7a21eb95ca4625bd5eaef7e0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" DROP CONSTRAINT "FK_66105a91f78a99b9a0468fbe98d"`,
    );
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TABLE "uploaded-images"`);
    await queryRunner.query(
      `DROP TYPE "public"."uploaded-images_upload_status_enum"`,
    );
  }
}
