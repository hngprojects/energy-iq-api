import { MigrationInterface, QueryRunner } from "typeorm";

export class FuelPriceScaling1780690949401 implements MigrationInterface {
    name = 'FuelPriceScaling1780690949401'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "custom_fuel_price_naira" TYPE numeric(10,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" ALTER COLUMN "custom_fuel_price_naira" TYPE numeric(5,2)`);
    }

}
