import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayDisconnect,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { NotificationService } from './notification.service';
import { Socket } from 'socket.io';
import { NotificationSocketEvent } from './helpers/events';
import { ParseUUIDPipe } from '@nestjs/common';

@WebSocketGateway()
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly notificationService: NotificationService) {}

  async handleConnection(socket: Socket) {
    /**
     * join notification channel
     */
    return await this.notificationService.joinNotificationChannel(
      socket.handshake.query.user_id as string,
    );
  }

  handleDisconnect(socket: Socket) {
    socket._cleanup();
  }

  @SubscribeMessage(NotificationSocketEvent.JOIN_NOTIFICATION_CHANNEL)
  async joinNotificationChannel(
    @MessageBody('userId', ParseUUIDPipe) userId: string,
  ) {
    return await this.notificationService.joinNotificationChannel(userId);
  }
}
