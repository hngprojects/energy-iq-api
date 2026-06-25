import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ReportType } from '../../../common/enums/reports.type';
import { Type } from 'class-transformer';

export class GetReportsDto {
  @IsEnum(ReportType)
  @IsOptional()
  reportType?: ReportType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
