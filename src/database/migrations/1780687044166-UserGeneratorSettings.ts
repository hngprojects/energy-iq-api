import { MigrationInterface, QueryRunner } from "typeorm";

export class UserGeneratorSettings1780687044166 implements MigrationInterface {
    name = 'UserGeneratorSettings1780687044166'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "custom_fuel_price_naira" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "generator_average_daily_runtime_hours" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "generator_average_daily_runtime_hours"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "custom_fuel_price_naira"`);
    }

}
