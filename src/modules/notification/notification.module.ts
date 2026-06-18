import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { UsersModule } from '../users/users.module';
import { NotificationController } from './notification.controller';
import { NotificationModelAction } from './actions/notification.action';

@Module({
  imports: [UsersModule],
  providers: [
    NotificationGateway,
    NotificationModelAction,
    NotificationService,
  ],
  controllers: [NotificationController],
})
export class NotificationModule {}
