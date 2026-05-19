import { IsDefined, IsUUID } from 'class-validator';

export class ResolveAlertDetailsDto {
  @IsUUID()
  @IsDefined()
  alertId: string;

  @IsUUID()
  @IsDefined()
  userId: string;
}
