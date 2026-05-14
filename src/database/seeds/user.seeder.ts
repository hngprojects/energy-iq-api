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

    const admin = repository.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash('Admin@123456', 10),
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
    });
    await repository.save(admin);

    console.log(
      `[UserSeeder] created admin user → ${adminEmail} / Admin@123456`,
    );
  },
};
