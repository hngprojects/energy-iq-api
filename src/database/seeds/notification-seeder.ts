import { Notification } from '../../modules/notification/entities/notification.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Seeder } from './seeder.interface';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';

export const notificationSeeder: Seeder = {
  name: 'NotificationSeeder',
  async run(dataSource: DataSource) {
    const userRepo = dataSource.getRepository(User);
    const notificationRepo = dataSource.getRepository(Notification);

    const adminEmail = 'admin@example.com';
    const existing = await userRepo.findOne({ where: { email: adminEmail } });
    if (!existing) {
      console.log(
        `[NotificationSeeder] user with email ${adminEmail} does not exist — skipping`,
      );
      return;
    }

    const notifications: Notification[] = [];
    const alreadySeeded = await notificationRepo.exists({
      where: { userId: existing.id },
    });
    if (alreadySeeded) {
      console.log(
        `[NotificationSeeder] notifications already exist for ${adminEmail} - skipping`,
      );
      return;
    }

    for (let i = 0; i < 20; i++) {
      const notification = notificationRepo.create({
        channelRoomId: randomUUID(),
        title: `title ${i}`,
        subtitle: `the quick brown fox jumps over the lazy dog ${i}`,
        textContent: `text content ${i}`,
        userId: existing.id,
      });
      notifications.push(notification);
    }

    await notificationRepo.save(notifications);
    console.log(`[NotificationSeeder] created notifications for ${adminEmail}`);
  },
};
