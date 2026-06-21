import {
  Inject,
  Injectable,
  Logger,
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
import { noTransaction } from '../../common/constants/transaction-options';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

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

    // Generate the title from the starting message before creating the chat
    // so it's included in the response object right away.
    const title =
      (await this.llmService.generateChatTitle(dto.startingMessage)) ??
      'New Chat';

    const chatPayload: Partial<Chat> = {
      contextLength: this.chatbotCfg.chatContextLength,
      expirationTimeoutSeconds: this.chatbotCfg.chatExpirationTimeoutSeconds,
      messages: [],
      roomId: randomUUID(),
      title,
      userId,
    };

    const chat = await this.chatModelAction.createChat(chatPayload);

    await this.messageModelAction.saveMessage({
      chat,
      content: dto.startingMessage,
      contentType: MessageContentType.TEXT,
      deliveryStatus: MessageDeliveryStatus.DELIVERED,
      isTransitioning: false,
      senderId: userId,
    });

    // Return the chat without the messages relation to avoid circular serialization
    chat.messages = [];
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

  async getSingleChat(chatId: string) {
    return await this.chatModelAction.findById(chatId);
  }

  async deleteSingleChat(chatId: string) {
    return await this.chatModelAction.delete({
      ...noTransaction(),
      identifierOptions: { id: chatId },
    });
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

  async sendMessageStream(
    socket: Socket,
    dto: ChatMessageDto,
  ): Promise<GatewayResponseDTO | null> {
    /**
     * Steps to send a message (streaming version)
     *
     * 1. Validate chat exists and belongs to user
     * 2. Save user's message to DB
     * 3. Emit TYPING action
     * 4. Load last N messages for context
     * 5. Call LLM in streaming mode, sending each token chunk via socket
     * 6. After stream ends, save the full bot message to DB
     * 7. Emit NEW_SYSTEM_MESSAGE with the complete message (so client can replace streaming buffer)
     * 8. Return final GatewayResponseDTO (optional, could be null because we already emitted everything)
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

    // 1. Save user message
    await this.messageModelAction.saveMessage({
      chat,
      content: dto.textContent,
      contentType: dto.contentType,
      deliveryStatus: MessageDeliveryStatus.DELIVERED,
      isTransitioning: false,
      senderId: dto.senderId,
    });

    // 2. Emit typing action
    const botActionDto: BotActionDto = {
      action: BotAction.TYPING,
      description: `${this.chatbotCfg.chatbotName} is typing`,
    };
    socket.emit(ChatSocketEvent.CHAT_ACTION, botActionDto);

    // 3. Get user preferred language
    let userPreferredLanguage: string | null | undefined;
    try {
      userPreferredLanguage = await this.getUserPreferredLanguage(dto.senderId);
    } catch {
      userPreferredLanguage = undefined;
    }

    // 4. Load last N messages for context
    const messagesInContext =
      await this.messageModelAction.getMessagesWithCount(
        chat.id,
        this.chatbotCfg.chatContextLength,
      );

    // 5. Stream the AI response
    const onToken = (chunk: string) => {
      // Send each token chunk to the client
      // We emit to the socket directly (not to the room) so only the sender sees the stream
      socket.emit(ChatSocketEvent.TOKEN_CHUNK, {
        chatId: dto.chatId,
        content: chunk,
      });
    };

    let botMessage: Message | null = null;
    try {
      const fullContent = await this.llmService.invokeWithHistoryStream(
        messagesInContext,
        dto.senderId,
        onToken,
        userPreferredLanguage ? userPreferredLanguage : undefined,
      );

      // 6. Save the complete bot message to DB
      botMessage = await this.messageModelAction.saveMessage({
        chat,
        content: fullContent,
        contentType: MessageContentType.TEXT,
        deliveryStatus: MessageDeliveryStatus.DELIVERED,
        isTransitioning: false,
        senderId: SYSTEM_SENDER_ID,
      });

      // 7. Fire card generation if the user has cards enabled (fire-and-forget).
      // Runs after the stream completes so it never delays token delivery.
      if (fullContent) {
        void this.usersService
          .getUserSetting(dto.senderId, 'chatCardsEnabled')
          .then((cardsEnabled) => {
            // Default is enabled — only skip if explicitly set to false
            if (cardsEnabled === false) return;
            return this.llmService
              .generateCards(
                dto.textContent,
                fullContent,
                userPreferredLanguage ?? undefined,
              )
              .then((cardResponse) => {
                if (cardResponse) {
                  socket.emit(ChatSocketEvent.CARDS, {
                    chatId: dto.chatId,
                    cards: cardResponse.cards,
                  });
                }
              });
          })
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Card generation failed: ${msg}`);
          });
      }
    } finally {
      // 7. Emit stream_end so the client can finalize (e.g., remove "typing" indicator)
      socket.emit(ChatSocketEvent.STREAM_END, {
        chatId: dto.chatId,
        botMessageId: botMessage?.id ?? null,
      });
    }

    // 8. Emit the final complete message to the room
    // This lets ALL clients in the room (if multi-device) get the final message
    return {
      roomId: chat.roomId,
      event: ChatSocketEvent.NEW_SYSTEM_MESSAGE,
      data: botMessage,
    };
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
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Agent invocation failed: ${errMsg}`);
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
