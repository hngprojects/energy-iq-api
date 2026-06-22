import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
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
  ) {}

  async generateReport(dto: ReportsDto, userId: string): Promise<Report> {
    const inverter = await this.invertersService.findOne(dto.inverterId);

    this.validateDtoDates(dto);

    if (!inverter) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (inverter.userId !== userId)
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    let created: Report;

    if (dto.mode === GenerateReportMode.PERIOD) {
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

  async getReportById(reportId: string): Promise<Report | null> {
    return await this.reportModelAction.findById(reportId);
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

  private parseDateOrThrow(value: string, field: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return d;
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
}
