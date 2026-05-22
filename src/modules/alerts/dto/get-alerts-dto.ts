import {
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { AlertType } from '../../../common/enums';
import { Type } from 'class-transformer';

export class GetAlertsDto {
  @IsOptional()
  @IsString()
  alert_type?: AlertType;

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

  @IsUUID()
  @IsDefined()
  userId: string;
}
