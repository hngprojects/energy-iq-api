import { IsDefined, IsInt, IsString, IsUUID } from 'class-validator';
import { AlertType } from '../../../common/enums';

export class GetAlertsDto {
  @IsString()
  alert_type?: AlertType;

  @IsInt()
  page_number?: number;

  @IsInt()
  page_size: number;

  @IsUUID()
  @IsDefined()
  userId: string;
}
