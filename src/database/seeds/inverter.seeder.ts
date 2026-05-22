import { DataSource } from 'typeorm';
import { Seeder } from './seeder.interface';
import { Inverter } from '../../modules/inverters/entities/inverters.entity';
import { User } from '../../modules/users/entities/user.entity';
import { InverterApiType, InverterBrand } from '../../common/enums';
import crypto from 'node:crypto';

export const inverterSeeder: Seeder = {
  name: 'InverterSeeder',
  async run(dataSource: DataSource) {
    const userRepository = dataSource.getRepository(User);
    const inverterRepository = dataSource.getRepository(Inverter);

    const adminEmail = 'admin@example.com';
    const adminUser = await userRepository.findOne({
      where: { email: adminEmail },
    });
    if (!adminUser) throw new Error('faile to get admin user');

    const existing = await inverterRepository.findOne({
      where: { user: adminUser },
    });
    if (existing) {
      console.log(`[UserSeeder] ${adminEmail} already exists — skipping`);
      return;
    }

    await inverterRepository.deleteAll();

    const inverter = inverterRepository.create({
      userId: adminUser.id,
      brand: InverterBrand.VICTRON,
      model: 'inverter_model_1',
      serialNumber: '01234567890ABCD',
      installationId: crypto.randomUUID().toString(),
      apiType: InverterApiType.LIVE_API,
      encryptedCredentials: '***************************',
      isActive: true,
      lastSyncedAt: new Date(),
      ratedCapacityKwh: 12.5,
      panelCapacityKw: 12.5,
      user: adminUser,
    });
    await inverterRepository.save(inverter);

    console.log(
      `[InverterSeeder] created inverter → ${adminEmail}`,
    );
  },
};
