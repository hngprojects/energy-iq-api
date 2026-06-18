import { ApiProperty } from '@nestjs/swagger';
import { ReportPeriod } from '../../../common/enums/reports.type';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReportsDto {
  @ApiProperty({
    example: 'Solar Performance - May Wk 1',
    description: 'Given name of the report',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiProperty({
    example: 'weekly',
    description: 'period for which the user wants the report',
  })
  @IsEnum(ReportPeriod)
  period: ReportPeriod;

  @IsOptional()
  referenceDate?: string;

  @IsOptional()
  startDate?: string;

  @IsOptional()
  endDate?: string;

  inverterId: string;
}
