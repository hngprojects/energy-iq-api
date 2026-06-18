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

  async createNotitfication(data: Notification) {
    return await this.create({
      createPayload: data,
      ...noTransaction(),
    });
  }

  async findNotificationsWhere(dto: GetNotificationsDto) {
    const notifications = await this.find({
      findOptions: {
        userId: dto.userId,
      },
      paginationPayload: {
        limit: dto.page_size!,
        page: dto.page_number!,
      },
      ...noTransaction(),
    });
    return notifications;
  }

  async findUnreadNotificationsWhere(dto: GetNotificationsDto) {
    const notifications = await this.find({
      findOptions: {
        userId: dto.userId,
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
