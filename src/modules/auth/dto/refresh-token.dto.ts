import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    name: 'sessionId',
    description: 'id of the session user wants to refresh'
  })
  @IsUUID()
  sessionId: string;
}
