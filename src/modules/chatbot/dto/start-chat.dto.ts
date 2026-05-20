import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartChatDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'Why did my battery drain fast last night?' })
  startingMessage?: string;
}
