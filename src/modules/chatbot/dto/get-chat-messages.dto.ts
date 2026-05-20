import { IsUUID } from 'class-validator';

export class GetChatMessagesDto {
  @IsUUID()
  chatId: string;

  @IsUUID()
  userId: string;
}
