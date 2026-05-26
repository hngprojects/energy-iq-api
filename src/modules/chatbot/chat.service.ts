import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ModifyChatSettingsDTO } from './dto/modify-chat-settings.dto';
import { ChatModelAction } from './actions/chat.action';
import { UsersService } from '../users/users.service';
import { StartChatDto } from './dto/start-chat.dto';
import { SYS_MSG } from '../../common/constants/sys-msg';
import type { ConfigType } from '@nestjs/config';
import { chatbotConfig } from '../../config/chatbot.config';
import { randomUUID } from 'node:crypto';
import { Chat } from './entities/chat.entity';
import { GetChatMessagesDto } from './dto/get-chat-messages.dto';
import { MessageModelAction } from './actions/message.action';
import { MessageContentType } from './helpers/content-type';
import { MessageDeliveryStatus } from './helpers/delivery-status';
import { Socket } from 'socket.io';
import { RejoinRoomsDto } from './dto/rejoin-rooms.dto';
import { ChatSocketEvent } from './helpers/event';
import { ChatMessageDto } from './dto/chat-message.dto';
import { BotActionDto } from './dto/bot-action.dto';
import { BotAction } from './helpers/bot-action';
import { Message } from './entities/message.entity';
import { AgentService } from './agent.service';
import { SYSTEM_SENDER_ID } from './helpers/constants';
import { GatewayResponseDTO } from './dto/gateway-response.dto';

@Injectable()
export class ChatService {
  constructor(
    @Inject(chatbotConfig.KEY)
    private readonly chatbotCfg: ConfigType<typeof chatbotConfig>,
    private readonly chatModelAction: ChatModelAction,
    private readonly llmService: AgentService,
    private readonly messageModelAction: MessageModelAction,
    private readonly usersService: UsersService,
  ) {}

  async joinActiveChatRooms(socket: Socket, dto: RejoinRoomsDto) {
    await this.usersService.findOne(dto.userId); // throws an error if the user is not found
    const chats = await this.chatModelAction.findActiveChatsByUserId(
      dto.userId,
    );
    for (const chat of chats) {
      await socket.join(chat.roomId);
    }
    socket.emit(ChatSocketEvent.JOINED, chats);
  }

  async startChat(dto: StartChatDto, userId: string) {
    // Ensure the authenticated user exists
    await this.usersService.findOne(userId);

    const chatPayload: Partial<Chat> = {
      contextLength: this.chatbotCfg.chatContextLength,
      expirationTimeoutSeconds: this.chatbotCfg.chatExpirationTimeoutSeconds,
      messages: [],
      roomId: randomUUID(),
      userId,
    };

    const chat = await this.chatModelAction.createChat(chatPayload);
    if (dto.startingMessage) {
      const message = await this.messageModelAction.saveMessage({
        chat,
        content: dto.startingMessage,
        contentType: MessageContentType.TEXT,
        deliveryStatus: MessageDeliveryStatus.DELIVERED,
        isTransitioning: false,
        senderId: userId,
      });
      if (chat.messages) chat.messages.push(message);
      else chat.messages = [message];
    }
    return chat;
  }

  async getChatsForUser(userId: string) {
    await this.usersService.findOne(userId); // this is meant to throw an exception if the user is invalid
    const chats = await this.chatModelAction.findByUserId(userId);
    return chats;
  }

  async getChatMessages(dto: GetChatMessagesDto) {
    const chat = await this.chatModelAction.findById(dto.chatId);
    if (!chat) throw new NotFoundException(SYS_MSG.NOT_FOUND);

    if (chat.userId !== dto.userId)
      throw new UnauthorizedException(SYS_MSG.FORBIDDEN);

    return this.messageModelAction.findByChatId(chat.id);
  }

  getSingleChat(chatId: string) {
    return this.chatModelAction.findById(chatId);
  }

  getSuggestedChatQuestions() {}

  modifyChatSettings(chatId: string, dto: ModifyChatSettingsDTO) {
    /**
     * Steps to modify chat settings
     *
     * Ensure that a chat exists with the id exists
     * update the chat settings
     * return the updated chat to the user
     */
    return { chatId, dto };
  }

  async sendMessage(
    socket: Socket,
    dto: ChatMessageDto,
  ): Promise<GatewayResponseDTO | null> {
    /**
     * Steps to send a message
     *
     * throw an error if the chat does not exist
     * throw an error if the chat was not started by the user
     * save the message
     * [MAYBE] recreate chat context with last 10 messages
     * send message to LLM integration
     * return message to the sender
     */
    const chat = await this.chatModelAction.findById(dto.chatId);
    if (!chat) {
      socket.emit(ChatSocketEvent.ERROR, SYS_MSG.NOT_FOUND);
      return null;
    }

    if (chat.userId !== dto.senderId) {
      return {
        roomId: chat.roomId,
        event: ChatSocketEvent.ERROR,
        data: SYS_MSG.FORBIDDEN,
      };
    }

    await this.messageModelAction.saveMessage({
      chat,
      content: dto.textContent,
      contentType: dto.contentType,
      deliveryStatus: MessageDeliveryStatus.DELIVERED,
      isTransitioning: false,
      senderId: dto.senderId,
    });

    const botActionDto: BotActionDto = {
      action: BotAction.TYPING,
      description: `${this.chatbotCfg.chatbotName} is typing`,
    };
    socket.emit(ChatSocketEvent.CHAT_ACTION, botActionDto);

    let userPreferredLanguage: string | null | undefined;

    try {
      userPreferredLanguage = await this.getUserPreferredLanguage(dto.senderId);
    } catch {
      userPreferredLanguage = undefined;
    }

    // feed the last ten messages into the LLM
    const messagesInContext =
      await this.messageModelAction.getMessagesWithCount(
        chat.id,
        this.chatbotCfg.chatContextLength,
      );
    let botMessageContent: string;
    try {
      const result = await this.llmService.invokeWithHistory(
        messagesInContext,
        dto.senderId,
        userPreferredLanguage ? userPreferredLanguage : undefined,
      );
      botMessageContent = result as string;
    } catch (err) {
      console.error('[AgentService] invokeWithHistory failed:', err);
      botMessageContent =
        'Sorry, something went wrong on my end. Please try again.';
    }

    const botMessage = await this.messageModelAction.saveMessage({
      chat,
      content: botMessageContent,
      contentType: MessageContentType.TEXT,
      deliveryStatus: MessageDeliveryStatus.DELIVERED,
      isTransitioning: false,
      senderId: SYSTEM_SENDER_ID,
    });

    return {
      roomId: chat.roomId,
      event: ChatSocketEvent.NEW_SYSTEM_MESSAGE,
      data: botMessage,
    };
  }

  private async getUserPreferredLanguage(
    userId: string,
  ): Promise<string | null | undefined> {
    return await this.usersService.getUserSetting(userId, 'AiLanguage');
  }

  getLastContextLengthMessages(chatId: string): Promise<Message[]> {
    return this.messageModelAction.getMessagesWithCount(
      chatId,
      this.chatbotCfg.chatContextLength,
    );
  }
}
