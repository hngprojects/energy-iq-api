import { ReportType } from '../../common/enums/reports.type';

export const REPORT_JOBS = {
  COMPUTE_REPORT: 'compute-report',
  SEND_REPORT: 'send-report',
};

export interface ComputeReportJobData {
  reportId: string;
}

export interface SendReportJobData {
  to: string;
  firstName: string;
  clientUrl: string;
  reportPdf: Buffer;
  type: ReportType;
  dateDelivered: string;
}

export type ReportJobData = ComputeReportJobData | SendReportJobData;
