import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications-dto';
import { NotificationModelAction } from './actions/notification.action';
import { noTransaction } from '../../common/constants/transaction-options';
import { UsersService } from '../users/users.service';
import { ProcessingStatus } from '../../common/constants/processing-status';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationAction: NotificationModelAction,
    private readonly usersService: UsersService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    const { userId, title, subtitle, textContent } = createNotificationDto;

    const notification = await this.notificationAction.create({
      ...noTransaction(),
      createPayload: {
        channelRoomId: userId,
        title,
        subtitle,
        textContent,
        userId,
      },
    });

    return 'This action adds a new notification' + JSON.stringify(notification);
  }

  async getUserNotifications(dto: GetNotificationsDto) {
    return await this.notificationAction.findNotificationsWhere(dto);
  }

  async getUnreadNotifications(dto: GetNotificationsDto) {
    return await this.notificationAction.findUnreadNotificationsWhere(dto);
  }

  async joinNotificationChannel(userId: string) {
    await this.usersService.findOne(userId);

    return userId;
  }

  async getActiveSessionsFids(userId: string): Promise<string[]> {
    return await this.usersService.getUserDeviceTokens(userId);
  }

  async updatePushDeliveryStatus(
    notificationId: string,
    userId: string,
    status: ProcessingStatus,
  ) {
    return await this.notificationAction.updateNotification(
      notificationId,
      userId,
      { pushDeliveryStatus: status },
    );
  }

  async markAsRead(notificationId: string, userId: string) {
    return await this.notificationAction.updateNotification(
      notificationId,
      userId,
      { isRead: true },
    );
  }
}
