import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayDisconnect,
  OnGatewayConnection,
  WsException,
  ConnectedSocket,
} from '@nestjs/websockets';
import { NotificationService } from './notification.service';
import { Socket } from 'socket.io';
import { NotificationSocketEvent } from './helpers/events';
import { Inject, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config/jwt.config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { SYS_MSG } from '../../common/constants/sys-msg';

interface AuthenticatedSocketData {
  user: JwtPayload;
}

@WebSocketGateway()
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);
  constructor(
    private readonly notificationService: NotificationService,
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(socket: Socket) {
    /**
     * join notification channel
     */
    try {
      const auth = socket.handshake.auth as Record<string, string | undefined>;
      const raw = auth.token;

      const token = typeof raw === 'string' ? raw.replace('Bearer ', '') : null;
      if (!token) throw new WsException('Missing token');

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwtCfg.accessSecret,
      });

      (socket.data as AuthenticatedSocketData).user = payload;

      const roomId = await this.notificationService.joinNotificationChannel(
        payload.sub,
      );

      await socket.join(roomId);

      return socket.emit(NotificationSocketEvent.JOINED_NOTIFICATION_CHANNEL, {
        roomId,
      });
    } catch (error) {
      this.logger.error(error);
      return socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    socket.disconnect();
  }

  @SubscribeMessage(NotificationSocketEvent.JOIN_NOTIFICATION_CHANNEL)
  async joinNotificationChannel(
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = (socket.data as AuthenticatedSocketData).user.sub;
    if (!userId) throw new WsException(SYS_MSG.UNAUTHORIZED);
    return await this.notificationService.joinNotificationChannel(userId);
  }
}
