import { IsDefined, IsInt, IsString, IsUUID } from 'class-validator';

export class GetAlertsDto {
  @IsString()
  alert_type?: string;

  @IsInt()
  page_number?: number;

  @IsInt()
  page_size: number;

  @IsUUID()
  @IsDefined()
  userId: string;
}
