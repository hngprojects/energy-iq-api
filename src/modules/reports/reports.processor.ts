import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queue';
import { Job } from 'bullmq';
import { ConflictException, Logger } from '@nestjs/common';
import { ComputeReportJobData, REPORT_JOBS } from './reports.jobs';
import { ReportsService } from './reports.service';
import { Report } from './entities/report.entity';
import { AnyReport } from './types/reports.type';
import { ReportStatus, ReportType } from '../../common/enums/reports.type';
import { SYS_MSG } from '../../common/constants/sys-msg';

@Processor(QUEUES.REPORT_DISPATCH)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);
  constructor(private readonly reportsService: ReportsService) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case REPORT_JOBS.COMPUTE_REPORT:
        return this.handleComputeReport(job as Job<ComputeReportJobData>);
      case REPORT_JOBS.SEND_REPORT:
        return () => {};
      default: {
        const message = `Unknown job type: ${job.name}`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private async handleComputeReport(
    job: Job<ComputeReportJobData>,
  ): Promise<void> {
    const { reportId } = job.data;

    const report = await this.reportsService.getReportById(reportId);

    if (!report) {
      this.logger.error(`No report with id ${reportId} found`);
      throw new Error(`No report with id ${reportId} found`);
    }
    if (report.status === ReportStatus.READY)
      throw new ConflictException(SYS_MSG.CONFLICT);

    this.logger.log(`Computing report Report_${reportId}`);

    try {
      const processed = await this.processReport(report);
      this.logger.log(
        `Successfully processed Report_${reportId}. Writing back to DB...`,
      );

      await this.reportsService.updateReport(reportId, processed, new Date());
    } catch (err) {
      const failedReport: Report = {
        ...report,
        type: report.type,
        status: ReportStatus.FAILED,
      };
      await this.reportsService.updateReport(
        reportId,
        failedReport as AnyReport,
        null,
      );
      this.logger.error(
        `Report_${reportId} failed computing`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async processReport(report: Report): Promise<AnyReport> {
    switch (report.type) {
      case ReportType.ALERT: {
        return this.reportsService.computeAlertReport(report);
      }
      case ReportType.CSC: {
        return this.reportsService.computeCostAndSavingsReport(report);
      }
      case ReportType.SOLAR: {
        return this.reportsService.computeSolarReport(report);
      }
      case ReportType.GENERAL: {
        return this.reportsService.computeGeneralReport(report);
      }
      default: {
        const message = `Unknown report type`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
  }
}
