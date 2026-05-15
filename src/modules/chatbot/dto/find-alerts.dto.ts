export class FindAlertsDto {
  count?: number;
  end_date?: Date;
  platform?: string;
  resolved?: boolean;
  severity?: string;
  start_date?: Date;
  type?: string;
  userId?: string;
}
