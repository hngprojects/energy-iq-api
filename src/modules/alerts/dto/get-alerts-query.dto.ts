import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AlertType } from '../../../common/enums';
import { Type } from 'class-transformer';

export class GetAlertsQueryDto {
  @ApiProperty({ example: 'low_battery' })
  @IsOptional()
  @IsString()
  alert_type?: AlertType;

  @ApiProperty({ example: 2, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_number?: number;

  @ApiProperty({ example: 10, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number;
}
