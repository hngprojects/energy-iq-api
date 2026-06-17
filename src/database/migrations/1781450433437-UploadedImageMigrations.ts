import { MigrationInterface, QueryRunner } from 'typeorm';

export class UploadedImageMigrations1781450433437 implements MigrationInterface {
  name = 'UploadedImageMigrations1781450433437';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "uploaded-images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "file_extname" character varying(10) NOT NULL, "filename" character varying(255), "filesize_bytes" bigint NOT NULL, "public_id" character varying(255) NOT NULL, "upload_status" "public"."uploaded-images_upload_status_enum" NOT NULL DEFAULT 'PENDING', "upload_url" text NOT NULL, "uploaded_by_email" character varying(255) NOT NULL, "thumbnail" text NOT NULL, "user_id" uuid, CONSTRAINT "REL_66105a91f78a99b9a0468fbe98" UNIQUE ("user_id"), CONSTRAINT "PK_4f8eff036504a3a4405701d75a8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" ADD CONSTRAINT "FK_66105a91f78a99b9a0468fbe98d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "uploaded-images" DROP CONSTRAINT "FK_66105a91f78a99b9a0468fbe98d"`,
    );
    await queryRunner.query(`DROP TABLE "uploaded-images"`);
  }
}
