import { AlertSeverity } from '../../alerts/enums/severity.enum';

export class FindAlertsDto {
  count?: number;
  end_date?: Date;
  platform?: string;
  resolved?: boolean;
  severity?: AlertSeverity;
  start_date?: Date;
  type?: string;
  userId?: string;
}
