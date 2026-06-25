import { IsNumber } from 'class-validator';

export class ReportTypesSummaryDto {
  @IsNumber()
  solar: number;

  @IsNumber()
  costsAndSavings: number;

  @IsNumber()
  alerts: number;

  @IsNumber()
  general: number;
}
