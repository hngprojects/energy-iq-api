import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queue';
import { Job } from 'bullmq';
import { ConflictException, Logger } from '@nestjs/common';
import {
  ComputeReportJobData,
  REPORT_JOBS,
  SendReportJobData,
} from './reports.jobs';
import { ReportsService } from './reports.service';
import { Report } from './entities/report.entity';
import { AnyReport } from './types/reports.type';
import {
  ReportPeriod,
  ReportStatus,
  ReportType,
} from '../../common/enums/reports.type';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { EmailService } from '../email/email.service';

@Processor(QUEUES.REPORT_DISPATCH)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case REPORT_JOBS.COMPUTE_REPORT:
        return this.handleComputeReport(job as Job<ComputeReportJobData>);
      case REPORT_JOBS.SEND_REPORT:
        return this.sendPdfReport(job as Job<SendReportJobData>);
      default: {
        const message = `Unknown job type: ${job.name}`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
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

    if (report.status !== ReportStatus.PENDING)
      throw new ConflictException(SYS_MSG.CONFLICT);

    this.logger.log(`Computing report Report_${reportId}`);

    // Atomic claim — only transitions from PENDING, returns null if another
    // worker already claimed it. Handled outside the try so contention is not
    // misidentified as a computation failure.
    const updated = await this.reportsService.updateReportStatus(
      report.id,
      ReportStatus.PROCESSING,
    );

    if (!updated) {
      // Another worker won the race — silently discard, not a failure.
      this.logger.warn(
        `Report_${reportId} already claimed by another worker — skipping`,
      );
      return;
    }

    try {
      const processed = await this.processReport(updated);
      this.logger.log(
        `Successfully processed Report_${reportId}. Writing back to DB...`,
      );

      await this.reportsService.updateReport(
        reportId,
        processed,
        processed.dateDelivered,
      );
      this.logger.log('Successfully updated status for report ', reportId);

      if (
        report.period !== ReportPeriod.CUSTOM &&
        report.recurring &&
        report.seriesId &&
        !Number.isNaN(report.occurrence) &&
        processed.dateDelivered
      ) {
        this.logger.log(
          `Report_${reportId} recurring; Scheduling new occurrence`,
        );
        try {
          await this.reportsService.generateNewSeriesReport(
            report,
            processed.dateDelivered,
          );
        } catch (scheduleErr) {
          this.logger.error(
            `Report_${reportId} processed but failed scheduling next occurence`,
            scheduleErr instanceof Error
              ? scheduleErr.stack
              : String(scheduleErr),
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Report_${reportId} failed computing`,
        err instanceof Error ? err.stack : String(err),
      );

      // Fix 3: On the last attempt write FAILED; on earlier attempts reset to PENDING
      // so the BullMQ retry passes the PENDING guard on the next run.
      const maxAttempts = job.opts?.attempts ?? 1;
      const isLastAttempt = job.attemptsMade >= maxAttempts - 1;

      if (isLastAttempt) {
        const failedReport: Report = { ...report, status: ReportStatus.FAILED };
        await this.reportsService.updateReport(
          reportId,
          failedReport as AnyReport,
          null,
        );
      } else {
        await this.reportsService.resetReportToPending(reportId);
      }

      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async sendPdfReport(job: Job<SendReportJobData>): Promise<void> {
    const { reportId, to, clientUrl, firstName } = job.data;

    try {
      await this.emailService.sendReportEmail(
        reportId,
        to,
        clientUrl,
        firstName,
      );
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : String(err));
      throw new Error(err instanceof Error ? err.message : String(err));
    }
  }

  private async processReport(report: Report): Promise<AnyReport> {
    switch (report.type) {
      case ReportType.ALERT:
        return this.reportsService.computeAlertReport(report);
      case ReportType.CSC:
        return this.reportsService.computeCostAndSavingsReport(report);
      case ReportType.SOLAR:
        return this.reportsService.computeSolarReport(report);
      case ReportType.GENERAL:
        return this.reportsService.computeGeneralReport(report);
      default: {
        const message = `Unknown report type: ${String(report.type)}`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
  }
}
