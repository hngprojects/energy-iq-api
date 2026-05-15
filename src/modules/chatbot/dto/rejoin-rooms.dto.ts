import { IsUUID } from 'class-validator';

export class RejoinRoomsDto {
  @IsUUID()
  userId: string;
}
