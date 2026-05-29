import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartChatDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Why did my battery drain fast last night?' })
  startingMessage: string;
}
