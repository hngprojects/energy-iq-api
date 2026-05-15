import { IsDefined, IsEnum, IsString, IsUUID } from 'class-validator';
import { MessageContentType } from '../helpers/content-type';

export class ChatMessageDto {
  @IsUUID()
  @IsDefined()
  chatId: string;

  @IsEnum(MessageContentType)
  contentType: MessageContentType;

  @IsUUID()
  senderId: string;

  @IsString()
  @IsDefined()
  textContent: string;
}
