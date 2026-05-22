import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../common/enums';
import { Seeder } from './seeder.interface';

export const userSeeder: Seeder = {
  name: 'UserSeeder',
  async run(dataSource: DataSource) {
    const repository = dataSource.getRepository(User);

    const adminEmail = 'admin@example.com';
    const existing = await repository.findOne({ where: { email: adminEmail } });
    if (existing) {
      console.log(`[UserSeeder] ${adminEmail} already exists — skipping`);
      return;
    }

    const adminPassword =
      process.env.SEED_ADMIN_PASSWORD ?? 'change-me-before-use';

    const admin = repository.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
    });
    await repository.save(admin);

    console.log(
      `[UserSeeder] created admin user → ${adminEmail} (password from SEED_ADMIN_PASSWORD env var)`,
    );
  },
};
