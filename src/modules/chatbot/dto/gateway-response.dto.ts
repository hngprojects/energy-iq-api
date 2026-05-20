import { IsDefined, IsEnum, IsUUID } from 'class-validator';
import { ChatSocketEvent } from '../helpers/event';

export class GatewayResponseDTO {
  @IsUUID()
  @IsDefined()
  roomId: string;

  @IsEnum(ChatSocketEvent)
  @IsDefined()
  event: ChatSocketEvent;

  @IsDefined()
  data: any;
}
