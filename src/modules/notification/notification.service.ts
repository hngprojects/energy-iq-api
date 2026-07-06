import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsDto } from './dto/get-notifications-dto';
import { NotificationModelAction } from './actions/notification.action';
import { noTransaction } from '../../common/constants/transaction-options';
import { UsersService } from '../users/users.service';
import { ProcessingStatus } from '../../common/constants/processing-status';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queue';
import { Queue } from 'bullmq';
import { Server } from 'socket.io';
import { NotificationSocketEvent } from './helpers/events';
import { PUSH_JOBS, SendPushJobData } from './notifications.jobs';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationAction: NotificationModelAction,
    private readonly usersService: UsersService,
    @InjectQueue(QUEUES.SEND_PUSH)
    private readonly pushQueue: Queue,
  ) {}

  private ioServer: Server | null = null;

  setIoServer(server: Server) {
    this.ioServer = server;
  }

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

    this.ioServer
      ?.to(userId)
      .emit(NotificationSocketEvent.NEW_NOTIFICATION, notification);

    await this.pushQueue.add(PUSH_JOBS.SEND_PUSH, {
      notificationId: notification.id,
      userId,
      title,
      body: subtitle,
    } satisfies SendPushJobData);

    return notification;
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
