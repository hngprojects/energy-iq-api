import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ModifyChatSettingsDTO } from './dto/modify-chat-settings.dto';
import { Throttle } from '@nestjs/throttler';
import { StartChatDto } from './dto/start-chat.dto';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatbotService: ChatService) {}

  @Post('')
  @Throttle({ default: { limit: 3, ttl: 3000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a new chat for an authenticated user' })
  startChat(
    @CurrentUser('sub', ParseUUIDPipe) userId: string,
    @Body() dto: StartChatDto,
  ) {
    return this.chatbotService.startChat({ ...dto, initiatorId: userId });
  }

  @Get('')
  @ApiOperation({ summary: 'Get all chats started by a user' })
  getChatsForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.chatbotService.getChatsForUser(user.sub);
  }

  @Get(':id/messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all the messages in a chat' })
  getChatMessages(
    @Param('id', ParseUUIDPipe) chatId: string,
    @Query('user_id', ParseUUIDPipe) userId: string,
  ) {
    return this.chatbotService.getChatMessages({ chatId, userId });
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single chat' })
  getSingleChat(@Param('id', ParseUUIDPipe) chatId: string) {
    return this.chatbotService.getSingleChat(chatId);
  }

  @Patch(':id/settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Make modifications to the settings of a chat' })
  modifyChatSettings(
    @Param('id', ParseUUIDPipe) chatId: string,
    @Body() dto: ModifyChatSettingsDTO,
  ) {
    return this.chatbotService.modifyChatSettings(chatId, dto);
  }
}
