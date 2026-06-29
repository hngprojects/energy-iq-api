export const REPORT_JOBS = {
  COMPUTE_REPORT: 'compute-report',
  SEND_REPORT: 'send-report',
  DELETE_REPORT: 'delete-report',
};

export interface ComputeReportJobData {
  reportId: string;
}

export interface SendReportJobData {
  to: string;
  firstName: string;
  clientUrl: string;
  reportId: string;
}

export interface DeleteUploadedReportJobData {
  reportId: string;
  publicId: string;
}

export type ReportJobData =
  | ComputeReportJobData
  | SendReportJobData
  | DeleteUploadedReportJobData;
