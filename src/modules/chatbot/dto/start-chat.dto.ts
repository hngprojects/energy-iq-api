import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StartChatDto {
  @IsUUID()
  @ApiProperty({ example: '46d2deff-1c0e-440b-8c76-e6890b39ea2b' })
  initiatorId: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Why did my battery drain fast last night?' })
  startingMessage?: string;

  @IsUUID()
  @ApiProperty({ example: '46d2deff-1c0e-440b-8c76-e6890b39ea2b' })
  userId: string;
}
