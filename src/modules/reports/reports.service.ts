import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { InvertersService } from '../inverters/inverters.service';
import { InvertersMetricsService } from '../inverters-metrics/inverters-metrics.service';
import { ReportModelAction } from './action/report.action';
import {
  AlertKeyMetrics,
  AlertReport,
  AnyReport,
  CostSavingsKeyMetrics,
  CostSavingsReport,
  GeneralKeyMetrics,
  GeneralReport,
  SolarKeyMetrics,
  SolarReport,
} from './types/reports.type';
import {
  ReportPeriod,
  ReportStatus,
  ReportType,
} from '../../common/enums/reports.type';
import { AlertsService } from '../alerts/alerts.service';
import { Report } from './entities/report.entity';
import { GenerateReportMode, ReportsDto } from './dto/reports.dto';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { noTransaction } from '../../common/constants/transaction-options';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queue';
import { Queue } from 'bullmq';
import {
  ComputeReportJobData,
  DeleteUploadedReportJobData,
  REPORT_JOBS,
  SendReportJobData,
} from './reports.jobs';
import { pdfmake } from './pdf-definitions/printer';
import { buildAlertReportDefinition } from './pdf-definitions/alert-report.definition';
import { buildCostSavingsReportDefinition } from './pdf-definitions/cost-savings-report.definition';
import { buildSolarReportDefinition } from './pdf-definitions/solar-report.definition';
import { buildGeneralReportDefinition } from './pdf-definitions/general-report.definition';
import { appConfig } from '../../config/app.config';
import { type ConfigType } from '@nestjs/config';
import { GetReportsDto } from './dto/get-reports.dto';
import { FindOptionsWhere } from 'typeorm';
import { ReportTypesSummaryDto } from './dto/report-types-summary.dto';
import { randomUUID } from 'crypto';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import { UploadedReportModelAction } from './action/uploaded-report.action';
import { UploadedReport } from './entities/uploaded-report.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly invertersService: InvertersService,
    private readonly usersService: UsersService,
    private readonly invertersMetricsService: InvertersMetricsService,
    private readonly reportModelAction: ReportModelAction,
    private readonly alertsService: AlertsService,
    @InjectQueue(QUEUES.REPORT_DISPATCH)
    private readonly reportQueue: Queue,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly uploadedReportModelAction: UploadedReportModelAction,
  ) {}

  async generateReport(dto: ReportsDto, userId: string): Promise<Report> {
    const inverter = await this.invertersService.findOne(dto.inverterId);

    if (dto.recurring && dto.mode === GenerateReportMode.CUSTOM_RANGE) {
      throw new BadRequestException(
        SYS_MSG.RECURRING_REPORTS_INVALID_COMBINATION,
      );
    }
    this.validateDtoDates(dto);

    const seriesId = dto.recurring ? randomUUID() : undefined;

    if (!inverter) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (inverter.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    let created: Report;

    if (dto.mode === GenerateReportMode.PERIOD) {
      if (
        new Date(dto.referenceDate!).getTime() < inverter.createdAt.getTime()
      ) {
        throw new ConflictException(
          'Reference Date cannot be before Inverter Creation',
        );
      }

      created = await this.reportModelAction.create({
        ...noTransaction(),
        createPayload: {
          userId,
          inverterId: dto.inverterId,
          type: dto.type,
          name: dto.name,
          period: dto.period,
          referenceDate: new Date(dto.referenceDate!),
          status: ReportStatus.PENDING,
          user: { id: userId },
          inverter: { id: dto.inverterId },
          recurring: dto.recurring,
          ...(dto.recurring && { occurrence: 1 }),
          ...(seriesId && { seriesId }),
        },
      });
    } else {
      created = await this.reportModelAction.create({
        ...noTransaction(),
        createPayload: {
          userId,
          inverterId: dto.inverterId,
          type: dto.type,
          name: dto.name,
          period: ReportPeriod.CUSTOM,
          startDate: new Date(dto.startDate!),
          endDate: new Date(dto.endDate!),
          status: ReportStatus.PENDING,
          user: { id: userId },
          inverter: { id: dto.inverterId },
          recurring: dto.recurring,
        },
      });
    }

    const delay = this.computeReportDelay(created);

    await this.reportQueue.add(
      REPORT_JOBS.COMPUTE_REPORT,
      {
        reportId: created.id,
      } satisfies ComputeReportJobData,
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return created;
  }

  async generateNewSeriesReport(old: Report, newReferenceDate: Date) {
    if (
      !old.seriesId ||
      old.occurrence == null ||
      !Number.isInteger(old.occurrence)
    )
      throw new ConflictException(SYS_MSG.CONFLICT);

    const renewed = await this.reportModelAction.create({
      ...noTransaction(),
      createPayload: {
        userId: old.userId,
        user: { id: old.userId },
        inverterId: old.inverterId,
        type: old.type,
        name: old.name,
        period: old.period,
        referenceDate: new Date(newReferenceDate),
        status: ReportStatus.PENDING,
        inverter: { id: old.inverterId },
        recurring: old.recurring,
        occurrence: Number(old.occurrence) + 1,
        seriesId: old.seriesId,
      },
    });

    const delay = this.computeReportDelay(renewed);

    await this.reportQueue.add(
      REPORT_JOBS.COMPUTE_REPORT,
      {
        reportId: renewed.id,
      } satisfies ComputeReportJobData,
      {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }

  async downloadReport(
    reportId: string,
    userId: string,
  ): Promise<{
    file: StreamableFile;
    report: Report;
  }> {
    const report = await this.reportModelAction.findById(reportId);

    if (!report) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (report.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);
    if (report.status !== ReportStatus.READY)
      throw new ConflictException(SYS_MSG.CONFLICT);

    const reportPdf = await this.getReportPdf(report);

    const safeName = report.name.replace(/[^\w.-]+/g, '_');
    const dateStr = report.dateDelivered
      ? report.dateDelivered.toISOString().split('T')[0]
      : 'unknown';
    const filename = `${report.type}_${safeName}_${dateStr}.pdf`;

    const file = new StreamableFile(reportPdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
      length: reportPdf.length,
    });

    return {
      file,
      report,
    };
  }

  async triggerReportEmail(reportId: string, userId: string): Promise<void> {
    const report = await this.reportModelAction.findById(reportId);

    try {
      if (!report) throw new NotFoundException(SYS_MSG.NOT_FOUND);
      if (report.userId !== userId)
        throw new ForbiddenException(SYS_MSG.FORBIDDEN);
      if (report.status !== ReportStatus.READY)
        throw new ConflictException(SYS_MSG.CONFLICT);

      const user = await this.usersService.findOne(report.userId);
      if (!user) throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);

      await this.reportQueue.add(REPORT_JOBS.SEND_REPORT, {
        to: user.email,
        firstName: user.firstName,
        clientUrl: `${this.appCfg.clientUrl}/dashboard/report`,
        reportId,
        // type: report.type,
        // dateDelivered: report.dateDelivered!.toISOString(),
      } satisfies SendReportJobData);
      return;
    } catch (err) {
      this.logger.error(err);
      if (err instanceof HttpException) throw err;
      throw new ServiceUnavailableException(
        'Failed to trigger report email. Try again',
      );
    }
  }

  async getUserReport(reportId: string, userId: string): Promise<Report> {
    const report = await this.getReportById(reportId);

    if (report.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    return report;
  }

  async getReportById(reportId: string): Promise<Report> {
    const report = await this.reportModelAction.findById(reportId);
    if (!report) throw new NotFoundException(SYS_MSG.NOT_FOUND);

    return report;
  }

  async getUploadedReportById(reportId: string): Promise<UploadedReport> {
    const uploadedReport =
      await this.uploadedReportModelAction.findByReportId(reportId);
    if (!uploadedReport) throw new NotFoundException(SYS_MSG.NOT_FOUND);

    return uploadedReport;
  }

  async getReports(dto: GetReportsDto, userId: string) {
    const findOptions: FindOptionsWhere<Report> = {
      userId,
      ...(dto.reportType && { type: dto.reportType }),
      ...(dto.endDate && { endDate: new Date(dto.endDate) }),
      ...(dto.startDate && { startDate: new Date(dto.startDate) }),
      ...(dto.status && { status: dto.status }),
      ...(dto.seriesId && { seriesId: dto.seriesId }),
    };

    return this.reportModelAction.find({
      findOptions,
      ...noTransaction(),
      paginationPayload: {
        limit: dto.pageSize ?? 10,
        page: dto.pageNumber ?? 1,
      },
    });
  }

  async getReportTypesSummary(userId: string): Promise<ReportTypesSummaryDto> {
    const [
      alertReportCount,
      costsAndSavingsReportCount,
      generalReportCount,
      solarReportCount,
    ] = await Promise.all([
      this.reportModelAction.getReportCountWhere({
        userId,
        type: ReportType.ALERT,
      }),
      this.reportModelAction.getReportCountWhere({
        userId,
        type: ReportType.CSC,
      }),
      this.reportModelAction.getReportCountWhere({
        userId,
        type: ReportType.GENERAL,
      }),
      this.reportModelAction.getReportCountWhere({
        userId,
        type: ReportType.SOLAR,
      }),
    ]);

    return {
      alerts: Number(alertReportCount),
      costsAndSavings: Number(costsAndSavingsReportCount),
      general: Number(generalReportCount),
      solar: Number(solarReportCount),
    };
  }

  async computeSolarReport(report: Report): Promise<SolarReport> {
    if (report.period === ReportPeriod.CUSTOM) {
      return await this.invertersMetricsService.getCustomRangeSolarReport(
        report,
      );
    }
    return await this.invertersMetricsService.getPeriodSolarReport(report);
  }

  async computeAlertReport(report: Report): Promise<AlertReport> {
    return await this.alertsService.getAlertReport(report);
  }

  async computeCostAndSavingsReport(
    report: Report,
  ): Promise<CostSavingsReport> {
    if (report.period === ReportPeriod.CUSTOM) {
      return await this.invertersMetricsService.getCustomRangeCostsAndSavingsReport(
        report,
      );
    }
    return await this.invertersMetricsService.getPeriodCostsAndSavingsReport(
      report,
    );
  }

  async computeGeneralReport(report: Report): Promise<GeneralReport> {
    const [
      { keyMetrics: alertKeyMetrics },
      { keyMetrics: cscKeyMetrics },
      { keyMetrics: solarKeyMetrics },
    ] = await Promise.all([
      this.computeAlertReport(report),
      this.computeCostAndSavingsReport(report),
      this.computeSolarReport(report),
    ]);

    return {
      name: report.name,
      period: report.period,
      status: ReportStatus.READY,
      // dateRequested: report.dateRequested,
      dateDelivered: new Date(),
      type: ReportType.GENERAL,
      keyMetrics: {
        ...alertKeyMetrics,
        ...cscKeyMetrics,
        ...solarKeyMetrics,
      },
    };
  }

  async updateReport(
    id: string,
    report: AnyReport,
    dateDelivered: Date | null,
  ): Promise<Report | null> {
    return await this.reportModelAction.updateReport(
      id,
      report.keyMetrics,
      report.status,
      dateDelivered,
    );
  }

  async updateReportStatus(
    id: string,
    status: ReportStatus,
  ): Promise<Report | null> {
    return await this.reportModelAction.updateReportStatus(id, status);
  }

  async resetReportToPending(id: string): Promise<void> {
    await this.reportModelAction.updateReportStatusUnconditional(
      id,
      ReportStatus.PENDING,
    );
  }

  async resetStalledProcessingReports(
    olderThanMinutes: number,
  ): Promise<number> {
    return await this.reportModelAction.resetStalledProcessingReports(
      olderThanMinutes,
    );
  }

  async cancelReports(id: string, userId: string): Promise<Report> {
    const report = await this.getReportById(id);

    if (report.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);
    const cancelled = await this.reportModelAction.updateReportStatus(
      id,
      ReportStatus.CANCELLED,
    );
    if (!cancelled) throw new ConflictException(SYS_MSG.CONFLICT);
    return cancelled;
  }

  async deleteReports(id: string, userId: string) {
    const report = await this.getReportById(id);

    if (report.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);
    if (report.status === ReportStatus.PROCESSING)
      throw new ConflictException(SYS_MSG.CONFLICT);
    return await this.reportModelAction.delete({
      identifierOptions: { id },
      ...noTransaction(),
    });
  }

  async getShareableLink(reportId: string, userId: string): Promise<string> {
    // This throws
    await this.usersService.findOne(userId);

    const report = await this.getReportById(reportId);
    if (report.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    const uploadedReport = await this.getUploadedReportById(reportId);

    return `${this.appCfg.clientUrl}/share/${uploadedReport.shareToken}`;
  }

  async accessShareableLink(shareToken: string): Promise<string> {
    const uploadedReport =
      await this.uploadedReportModelAction.findByShareToken(shareToken);
    if (!uploadedReport) throw new NotFoundException(SYS_MSG.NOT_FOUND);

    if (
      uploadedReport.shareableLinkExpiresAt &&
      Date.now() > uploadedReport.shareableLinkExpiresAt.getTime()
    ) {
      await this.deleteRemoteReport(
        uploadedReport.reportId,
        uploadedReport.cloudinaryPublicId,
      );
      throw new GoneException(SYS_MSG.SHAREABLE_LINK_EXPIRED);
    }

    await this.uploadedReportModelAction.update({
      ...noTransaction(),
      identifierOptions: { shareToken },
      updatePayload: {
        downloadCount: uploadedReport.downloadCount + 1,
      },
    });

    return uploadedReport.cloudinaryUrl;
  }

  async generateShareableLink(id: string, userId: string): Promise<string> {
    await this.usersService.findOne(userId);
    // The above function already throws

    const report = await this.getReportById(id);
    if (report.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    const { shareToken } = await this.uploadReportToCloudinary(id);
    const clientUrl = this.appCfg.clientUrl;

    const shareableLink = `${clientUrl}/share/${shareToken}`;

    return shareableLink;
  }

  async uploadReportToCloudinary(id: string) {
    const report = await this.reportModelAction.findById(id);
    if (!report) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (report.status !== ReportStatus.READY)
      throw new ConflictException(SYS_MSG.CONFLICT);

    const reportPdfBuffer = await this.getReportPdf(report);

    const filename = `${
      report.name
        .toLowerCase()
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .filter((s) => s.length > 0)
        .join('-') + Date.now()
    }-${Date.now()}`;
    const fileMeta = {
      filename,
      fileExtname: '.pdf',
      filesizeBytes: reportPdfBuffer.byteLength.toString(),
      mimeType: 'application/pdf',
    };

    let uploadRes: Awaited<
      ReturnType<CloudinaryService['signedUploadFileFromMetadata']>
    > = null;

    try {
      uploadRes = await this.cloudinaryService.signedUploadFileFromMetadata(
        'user_reports',
        fileMeta,
        reportPdfBuffer,
      );

      if (!uploadRes)
        throw new ServiceUnavailableException(SYS_MSG.ERROR_UPLOADING_FILE);

      const shareToken = randomUUID();

      const shareableLinkExpiresAt = new Date();
      shareableLinkExpiresAt.setDate(shareableLinkExpiresAt.getDate() + 7);

      const fullUploadedReport = {
        ...uploadRes,
        reportId: report.id,
        report,
        user: report.user,
        userId: report.userId,
        shareToken,
        shareableLinkExpiresAt,
      };

      const { uploadedReport, existingUploadedReport } =
        await this.uploadedReportModelAction.upsertUploadedReport(
          report.id,
          fullUploadedReport,
        );

      const oldJobId =
        existingUploadedReport?.deleteJobId ?? uploadedReport.deleteJobId;
      if (oldJobId) {
        await this.reportQueue.remove(oldJobId).catch(() => {
          this.logger.debug(`Job ${oldJobId} already removed or not found`);
        });
      }

      const oldPublicId = existingUploadedReport?.cloudinaryPublicId;
      if (oldPublicId && oldPublicId !== uploadedReport.cloudinaryPublicId) {
        await this.cloudinaryService.deleteByPublicId(oldPublicId);
      }

      // Job that deletes at the right time;
      if (uploadedReport.shareableLinkExpiresAt) {
        const delay =
          uploadedReport.shareableLinkExpiresAt.getTime() - Date.now();
        const jobId = randomUUID();
        await this.reportQueue.add(
          REPORT_JOBS.DELETE_REPORT,
          {
            reportId: uploadedReport.reportId,
            publicId: uploadedReport.cloudinaryPublicId,
          } satisfies DeleteUploadedReportJobData,
          {
            jobId,
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );

        if (delay > 0) {
          await this.uploadedReportModelAction.update({
            ...noTransaction(),
            identifierOptions: { shareToken: uploadedReport.shareToken },
            updatePayload: {
              deleteJobId: jobId,
            },
          });
        }
      }

      return uploadedReport;
    } catch (err) {
      if (uploadRes?.cloudinaryPublicId) {
        await this.cloudinaryService.deleteByPublicId(
          uploadRes.cloudinaryPublicId,
        );
      }
      this.logger.error(
        `Failed to upload report ${report.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof ServiceUnavailableException) throw err;
      throw new InternalServerErrorException(SYS_MSG.ERROR_UPLOADING_FILE);
    }
  }

  private validateDtoDates(dto: ReportsDto) {
    if (dto.mode === GenerateReportMode.CUSTOM_RANGE) {
      if (!dto.startDate)
        throw new BadRequestException(
          'startDate must be defined for custom range report mode',
        );
      if (!dto.endDate)
        throw new BadRequestException(
          'endDate must be defined for custom range report mode',
        );
      if (dto.period !== ReportPeriod.CUSTOM)
        throw new BadRequestException(
          'period must be custom for custom range report mode',
        );

      if (dto.startDate >= dto.endDate) {
        throw new BadRequestException('startDate must be less than endDate');
      }
    } else if (dto.mode === GenerateReportMode.PERIOD) {
      if (!dto.period)
        throw new BadRequestException(
          'period must be defined for period report mode',
        );
      if (dto.period === ReportPeriod.CUSTOM)
        throw new BadRequestException(
          'period must be weekly or monthly for period report mode',
        );
      if (!dto.referenceDate)
        throw new BadRequestException(
          'Reference date must be defined for period report mode',
        );
    } else {
      throw new UnprocessableEntityException(
        'mode must be custom-range or period',
      );
    }
  }

  private computeReportDelay(report: Report): number {
    if (report.period === ReportPeriod.CUSTOM) {
      if (!report.startDate || !report.endDate)
        throw new BadRequestException(
          `startDate and endDate compulsory for custom period`,
        );

      const dueTime = report.endDate.getTime();

      return Math.max(dueTime - Date.now(), 0);
    } else {
      if (!report.referenceDate)
        throw new BadRequestException(
          'referenceDate must be defined when period is not custom',
        );
      const { rangeEnd } = this.getPeriodRange(
        report.period,
        report.referenceDate,
      );

      return Math.max(rangeEnd.getTime() - Date.now(), 0);
    }
  }

  private getPeriodRange(
    period: ReportPeriod,
    date: Date,
  ): {
    rangeStart: Date;
    rangeEnd: Date;
  } {
    // Work in Lagos local time for day/week/month boundaries
    const d = date instanceof Date ? date : new Date(date);

    let rangeStart: Date;
    let rangeEnd: Date;

    switch (period) {
      case ReportPeriod.WEEKLY: {
        // ISO week containing `date` — group by day
        const dayOfWeek = d.getDay(); // 0 = Sunday
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        rangeStart = new Date(d);
        rangeStart.setDate(d.getDate() + mondayOffset);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeStart.getDate() + 7);
        break;
      }
      case ReportPeriod.MONTHLY: {
        // Calendar month containing `date` — group by day
        rangeStart = new Date(d.getFullYear(), d.getMonth(), 1);
        rangeEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        break;
      }
      default:
        throw new Error(`Unsupported report period: ${period}`);
    }

    return { rangeStart, rangeEnd };
  }

  async getReportPdf(report: Report): Promise<Buffer> {
    const base = {
      name: report.name,
      period: report.period,
      status: report.status,
      dateDelivered: report.dateDelivered ?? null,
    };

    switch (report.type) {
      case ReportType.ALERT:
        return this.renderPdf(
          buildAlertReportDefinition({
            ...base,
            metrics: report.keyMetrics as AlertKeyMetrics,
          }),
        );

      case ReportType.CSC:
        return this.renderPdf(
          buildCostSavingsReportDefinition({
            ...base,
            metrics: report.keyMetrics as CostSavingsKeyMetrics,
          }),
        );

      case ReportType.SOLAR:
        return this.renderPdf(
          buildSolarReportDefinition({
            ...base,
            metrics: report.keyMetrics as SolarKeyMetrics,
          }),
        );

      case ReportType.GENERAL:
        return this.renderPdf(
          buildGeneralReportDefinition({
            ...base,
            metrics: report.keyMetrics as GeneralKeyMetrics,
          }),
        );

      default:
        throw new BadRequestException(
          `Unknown report type: ${String(report.type)}`,
        );
    }
  }

  private async renderPdf(
    docDefinition: Parameters<typeof pdfmake.createPdf>[0],
  ): Promise<Buffer> {
    return pdfmake.createPdf(docDefinition).getBuffer();
  }

  async deleteRemoteReport(
    reportId: string,
    publicId: string,
  ): Promise<boolean> {
    // This throws if report does not exist
    await this.getReportById(reportId);
    const remoteReport = await this.getUploadedReportById(reportId);

    if (remoteReport.cloudinaryPublicId !== publicId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    const deleted = await this.cloudinaryService.deleteByPublicId(publicId);
    if (!deleted) {
      throw new ServiceUnavailableException(SYS_MSG.INTERNAL_SERVER_ERROR);
    }
    await this.uploadedReportModelAction.delete({
      ...noTransaction(),
      identifierOptions: { reportId, cloudinaryPublicId: publicId },
    });
    return true;
  }
}
