import { ApiProperty } from '@nestjs/swagger';
import { ReportPeriod, ReportType } from '../../../common/enums/reports.type';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum GenerateReportMode {
  CUSTOM_RANGE = 'custom-date',
  PERIOD = 'period',
}

export class ReportsDto {
  @ApiProperty({
    name: 'mode',
    enum: GenerateReportMode,
    default: GenerateReportMode.PERIOD,
  })
  @IsEnum(GenerateReportMode)
  mode: GenerateReportMode;

  @ApiProperty({
    example: '000-1111-2222-xxxx',
    description: 'id of the inverter this report is associated with',
  })
  @IsUUID()
  inverterId: string;

  @ApiProperty({
    enum: ReportType,
    example: ReportType.ALERT,
    description: 'The type of the report in question',
  })
  @IsEnum(ReportType)
  type: ReportType;

  @ApiProperty({
    example: 'Solar Performance - May Wk 1',
    description: 'Given name of the report',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiProperty({
    enum: ReportPeriod,
    example: ReportPeriod.WEEKLY,
    description: 'period for which the user wants the report',
  })
  @IsEnum(ReportPeriod)
  @IsOptional()
  @ValidateIf((r: ReportsDto) => r.mode === GenerateReportMode.PERIOD)
  period?: ReportPeriod;

  @ApiProperty({
    example: '2026-06-18',
    description: 'Date to begin counting the period from',
  })
  @IsDateString()
  @IsOptional()
  @ValidateIf((r: ReportsDto) => r.mode === GenerateReportMode.PERIOD)
  referenceDate?: string;

  @ApiProperty({
    example: '2026-06-18',
    description: 'startDate for the custom range',
  })
  @IsDateString()
  @IsOptional()
  @ValidateIf((r: ReportsDto) => r.mode === GenerateReportMode.CUSTOM_RANGE)
  startDate?: string;

  @ApiProperty({
    example: '2026-06-18',
    description: 'endDate for the custom range',
  })
  @IsDateString()
  @IsOptional()
  @ValidateIf((r: ReportsDto) => r.mode === GenerateReportMode.CUSTOM_RANGE)
  endDate?: string;
}
