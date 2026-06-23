import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationMigration1782212724789 implements MigrationInterface {
    name = 'NotificationMigration1782212724789'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "channel_room_id" text NOT NULL, "icon_url" text, "meta_data" json, "title" text NOT NULL, "subtitle" text NOT NULL, "text_content" text, "user_id" uuid NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "in_app_delivery_status" character varying(50) NOT NULL DEFAULT 'PENDING', "push_delivery_status" character varying(50) NOT NULL DEFAULT 'PENDING', CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
