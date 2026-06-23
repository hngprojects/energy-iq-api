import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { Notification } from '../entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetNotificationsDto } from '../dto/get-notifications-dto';
import { noTransaction } from '../../../common/constants/transaction-options';

@Injectable()
export class NotificationModelAction extends AbstractModelAction<Notification> {
  constructor(
    @InjectRepository(Notification) repository: Repository<Notification>,
  ) {
    super(repository, Notification);
  }

  async findNotificationsWhere(dto: GetNotificationsDto) {
    const pageNumber = dto.page_number ?? 1;
    const pageSize = dto.page_size ?? 10;

    const notifications = await this.find({
      findOptions: {
        userId: dto.userId,
      },
      paginationPayload: {
        limit: pageSize,
        page: pageNumber,
      },
      ...noTransaction(),
    });
    return notifications;
  }

  async findUnreadNotificationsWhere(dto: GetNotificationsDto) {
    const notifications = await this.find({
      findOptions: {
        userId: dto.userId,
        isRead: false,
      },
      paginationPayload: {
        limit: dto.page_size!,
        page: dto.page_number!,
      },
      ...noTransaction(),
    });
    return notifications;
  }

  async updateNotification(
    id: string,
    userId: string,
    options: Partial<Notification>,
  ) {
    const notification = await this.update({
      updatePayload: options,
      identifierOptions: { id, userId },
      ...noTransaction(),
    });
    return notification;
  }
}
