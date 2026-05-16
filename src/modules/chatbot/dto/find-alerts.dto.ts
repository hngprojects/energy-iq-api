import { AlertSeverity } from '../../../common/enums';

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
