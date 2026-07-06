import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReadNotificationDto {
  @ApiProperty({
    format: 'uuid',
    description: 'the id of the notification to be marked as read',
  })
  @IsUUID()
  id: string;
}
