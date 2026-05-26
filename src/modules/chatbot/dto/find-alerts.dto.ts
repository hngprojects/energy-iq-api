import { AlertSeverity, AlertType } from '../../../common/enums';

export class FindAlertsDto {
  count?: number;
  end_date?: Date;
  platform?: string;
  /** 'active' | 'resolved' | 'all' — replaces the old boolean `resolved` field */
  status?: 'active' | 'resolved' | 'all';
  severity?: AlertSeverity;
  start_date?: Date;
  type?: AlertType;
  userId?: string;
}
