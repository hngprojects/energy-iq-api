import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailAlertsDefaultTrue1779985917158 implements MigrationInterface {
  name = 'EmailAlertsDefaultTrue1779985917158';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ALTER COLUMN "email_alerts" SET DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_settings" ALTER COLUMN "email_alerts" SET DEFAULT false`,
    );
  }
}
