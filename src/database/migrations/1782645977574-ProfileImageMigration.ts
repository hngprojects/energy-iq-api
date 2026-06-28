import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfileImageMigration1782645977574 implements MigrationInterface {
  name = 'ProfileImageMigration1782645977574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "profile-images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "file_extname" character varying(10) NOT NULL, "filename" character varying(255), "filesize_bytes" bigint NOT NULL, "mime_type" character varying(255), "cloudinary_public_id" character varying(255) NOT NULL, "cloudinary_url" text NOT NULL, "thumbnail_url" text NOT NULL, "format" character varying(50), "resource_type" character varying(50) NOT NULL DEFAULT 'image', "version" integer, "metadata" jsonb, "user_id" uuid NOT NULL, CONSTRAINT "REL_2da24cb48551f621a194b37c43" UNIQUE ("user_id"), CONSTRAINT "PK_96d257fddd3dd62aa3c1b7210e1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "profile-images" ADD CONSTRAINT "FK_2da24cb48551f621a194b37c433" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile-images" DROP CONSTRAINT "FK_2da24cb48551f621a194b37c433"`,
    );
    await queryRunner.query(`DROP TABLE "profile-images"`);
  }
}
