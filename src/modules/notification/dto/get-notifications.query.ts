import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class GetNotificationsQuery {
  @ApiProperty({
    format: 'uuid',
    description: 'the id of the user whose notifications you want to fetch',
  })
  @IsUUID()
  userId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_number?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number;
}
