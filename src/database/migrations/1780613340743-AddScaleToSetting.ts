import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScaleToSetting1780613340743 implements MigrationInterface {
    name = 'AddScaleToSetting1780613340743'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "generator_rated_power_kw" TYPE numeric(5,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "generator_rated_power_kw" TYPE numeric(5,0)`);
    }

}
