import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPersonalSettings1779465381473 implements MigrationInterface {
    name = 'AddUserPersonalSettings1779465381473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "business_name" character varying`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "business_type" character varying`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "state" character varying`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "city" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "state"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "business_type"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "business_name"`);
    }

}
