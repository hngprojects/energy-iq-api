export enum ReportType {
  GENERAL = 'GENERAL',
  SOLAR = 'SOLAR',
  ALERT = 'ALERT',
  CSC = 'COSTS_AND_SAVINGS',
}

export enum ReportPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}
