import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { ChatSocketEvent } from './helpers/event';
import { Server, Socket } from 'socket.io';
import { RejoinRoomsDto } from './dto/rejoin-rooms.dto';
import { ChatMessageDto } from './dto/chat-message.dto';

@WebSocketGateway({ namespace: 'agent' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatbotService: ChatService) {}

  async handleConnection(socket: Socket) {
    await this.chatbotService.joinActiveChatRooms(socket, {
      userId: socket.handshake.query.user_id as string,
    });
  }

  handleDisconnect(socket: Socket) {
    socket._cleanup();
  }

  @SubscribeMessage(ChatSocketEvent.JOIN_ACTIVE_CHATS)
  async rejoinActiveChatRooms(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: RejoinRoomsDto,
  ) {
    await this.chatbotService.joinActiveChatRooms(socket, dto);
  }

  @SubscribeMessage(ChatSocketEvent.SEND_MESSAGE)
  async sendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: ChatMessageDto,
  ) {
    const response = await this.chatbotService.sendMessageStream(socket, dto);
    if (response) {
      this.server.to(response.roomId).emit(response.event, response.data);
    }
  }
}
