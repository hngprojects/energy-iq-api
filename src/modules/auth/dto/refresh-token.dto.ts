import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    name: 'sessionId',
    description: 'id of the session user wants to refresh',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    name: 'refresh token',
    description: 'raw refresh token, if the client is mobile'
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
