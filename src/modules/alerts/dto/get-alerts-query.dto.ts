import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class GetAlertsQueryDto {
  @ApiProperty({ example: 'low_battery' })
  @IsString()
  alert_type?: string;

  @ApiProperty({ example: '2', nullable: true })
  @IsInt()
  page_number?: number;

  @ApiProperty({ example: 'low_battery', nullable: true })
  @IsInt()
  page_size: number;
}
