import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID } from 'class-validator';

export class ModifyChatSettingsDTO {
  @IsUUID()
  @ApiProperty({ example: '46d2deff-1c0e-440b-8c76-e6890b39ea2b' })
  chatId: string;

  @IsInt()
  @IsOptional()
  contextLength: number;

  @IsInt()
  @IsOptional()
  expirationTimeoutSeconds: number;
}
