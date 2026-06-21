import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
    return this.chatbotService.startChat(dto, userId);
  }

  @Get('')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all chats started by a user' })
  @HttpCode(HttpStatus.OK)
  getChatsForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.chatbotService.getChatsForUser(user.sub);
  }

  @Get(':id/messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all the messages in a chat' })
  @HttpCode(HttpStatus.OK)
  getChatMessages(
    @Param('id', ParseUUIDPipe) chatId: string,
    @Query('user_id', ParseUUIDPipe) userId: string,
  ) {
    return this.chatbotService.getChatMessages({ chatId, userId });
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single chat' })
  @HttpCode(HttpStatus.OK)
  getSingleChat(
    @Param('id', ParseUUIDPipe) chatId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatbotService.getSingleChat(chatId, user.sub);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a single chat' })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSingleChat(
    @Param('id', ParseUUIDPipe) chatId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatbotService.deleteSingleChat(chatId, user.sub);
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
