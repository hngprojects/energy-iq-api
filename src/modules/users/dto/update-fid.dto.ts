import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Max, Min } from 'class-validator';

export class UpdateFidDto {
  @ApiProperty({ description: 'Session id of the session', name: 'Session ID' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    description: 'Firebase ID of the device in question',
    name: 'Firebase ID',
  })
  @IsString()
  @Min(1)
  @Max(50)
  token: string;
}
