import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ReadNotificationDto } from './dto/read-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications-dto';
import { NotificationModelAction } from './actions/notification.action';

@Injectable()
export class NotificationService {
  constructor(private readonly notificationAction: NotificationModelAction) {}

  create(createNotificationDto: CreateNotificationDto) {
    return (
      'This action adds a new notification' +
      JSON.stringify(createNotificationDto)
    );
  }

  async getUserNotifications(dto: GetNotificationsDto) {
    return await this.notificationAction.findNotificationsWhere(dto);
  }

  async getUnreadNotifications(dto: GetNotificationsDto) {
    return await this.notificationAction.findNotificationsWhere(dto);
  }

  async joinNotificationChannel(userId: string) {
    /**
     * Steps to join notification channel
     * fetch the user by id
     * use the user's id as their notification channel
     * join the notification room
     * send a joined event back to the client
     */
    return await Promise.resolve(
      `user with id ${userId} has joined the notification channel`,
    );
  }

  async markAsRead(dto: ReadNotificationDto) {
    return await this.notificationAction.updateNotification(
      dto.id,
      dto.userId,
      { isRead: true },
    );
  }
}
