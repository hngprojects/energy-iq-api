import { IsDefined, IsUUID } from 'class-validator';

export class GetAlertDetailsDto {
  @IsUUID()
  @IsDefined()
  alertId: string;

  @IsUUID()
  @IsDefined()
  userId: string;
}
