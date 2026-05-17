import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAlertTable1778927197796 implements MigrationInterface {
    name = 'CreateAlertTable1778927197796'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, "type" character varying(255) NOT NULL, "platform" character varying(50) NOT NULL, "severity" character varying(50) NOT NULL, "message" character varying(1024) NOT NULL, "resolution_status" character varying(50), "triggered_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "alerts"`);
    }

}
