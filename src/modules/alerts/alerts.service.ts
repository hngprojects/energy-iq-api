import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AlertModelAction } from './actions/alert.action';
import { GetAlertDetailsDto } from './dto/get-alert-details.dto';
import { FindOptionsWhere } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { noTransaction } from '../../common/constants/transaction-options';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { ResolveAlertDetailsDto } from './dto/resolve-alert.dto';
import { AlertSummaryDto } from './dto/alert-summary.dto';
import {
  AlertResolutionStatus,
  AlertSeverity,
  AlertType,
} from '../../common/enums';
import { GetAlertsDto } from './dto/get-alerts-dto';
import { type ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { AlertReport } from '../reports/types/reports.type';
import {
  ReportPeriod,
  ReportStatus,
  ReportType,
} from '../../common/enums/reports.type';
import { Report } from '../reports/entities/report.entity';
import { FindAlertsDto } from '../chatbot/dto/find-alerts.dto';

@Injectable()
export class AlertsService {
  constructor(
    private readonly alertAction: AlertModelAction,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  async getAlerts(dto: GetAlertsDto) {
    const findOptions: FindOptionsWhere<Alert> = {
      userId: dto.userId,
    };
    if (dto.alert_type) findOptions.type = dto.alert_type;
    return this.alertAction.find({
      findOptions,
      ...noTransaction(),
      paginationPayload: {
        limit: dto.page_size ?? 10,
        page: dto.page_number ?? 1,
      },
    });
  }

  async getAlertsSummary(userId: string): Promise<AlertSummaryDto> {
    const [
      activeAlertCount,
      criticalAlertCount,
      warningAlertCount,
      unresolvedCount,
    ] = await Promise.all([
      this.alertAction.getAlertCountWhere({
        userId,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      }),
      this.alertAction.getAlertCountWhere({
        userId,
        severity: AlertSeverity.CRITICAL,
      }),
      this.alertAction.getAlertCountWhere({
        userId,
        severity: AlertSeverity.WARNING,
      }),
      this.alertAction.getAlertCountWhere({
        userId,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      }),
    ]);

    return {
      active: Number(activeAlertCount),
      critical: Number(criticalAlertCount),
      unresolved: Number(unresolvedCount),
      warning: Number(warningAlertCount),
    };
  }

  async getAlertDetails(dto: GetAlertDetailsDto) {
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) {
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }
    if (alert.userId !== dto.userId) {
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);
    }
    return alert;
  }

  async resolveAlert(dto: ResolveAlertDetailsDto) {
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) {
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }
    if (alert.userId !== dto.userId) {
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);
    }
    return this.alertAction.markAsResolved(dto.alertId);
  }

  async getAlertReport(report: Report): Promise<AlertReport> {
    const { userId } = report;

    const daysLater = this.getReportSpanDays(report);
    if (!daysLater) throw new Error('Unable to calculate days difference');
    const startDate = report.referenceDate || report.startDate;
    const endDate = new Date();
    endDate.setDate(startDate!.getDate() + daysLater);

    const findAlertsOptions: FindAlertsDto = {
      start_date: startDate,
      end_date: endDate,
    };

    const alerts = await this.alertAction.findAlertsWhere(
      findAlertsOptions,
      userId,
    );

    const totalAlerts = alerts.length;
    const resolvedAlerts = alerts.filter(
      (a) => a.resolutionStatus === AlertResolutionStatus.RESOLVED,
    ).length;
    const unresolvedAlerts = alerts.filter(
      (a) => a.resolutionStatus === AlertResolutionStatus.UNRESOLVED,
    ).length;

    const resolutionRate =
      totalAlerts > 0
        ? parseFloat(((resolvedAlerts / totalAlerts) * 100).toFixed(2))
        : 0;

    const dominantAlertType = this.getDominantAlertType(alerts);
    const dominantAlertSeverity = this.getDominantAlertSeverity(alerts);

    return {
      name: report.name,
      period: report.period,
      status: ReportStatus.READY,
      dateDelivered: new Date(),
      type: ReportType.ALERT,
      keyMetrics: {
        totalAlerts,
        resolvedAlerts,
        unresolvedAlerts,
        dominantAlertType,
        dominantAlertSeverity,
        resolutionRate,
      },
    };
  }

  private getDominantAlertType(alerts: Alert[]): AlertType | null {
    if (alerts.length === 0) return null;

    const counts = alerts.reduce<Record<AlertType, number>>(
      (acc, alert) => {
        acc[alert.type] = (acc[alert.type] ?? 0) + 1;
        return acc;
      },
      {} as Record<AlertType, number>,
    );

    return Object.entries(counts).reduce((a, b) =>
      b[1] > a[1] ? b : a,
    )[0] as AlertType;
  }

  private getDominantAlertSeverity(alerts: Alert[]): AlertSeverity | null {
    if (alerts.length === 0) return null;

    const counts = alerts.reduce<Record<AlertSeverity, number>>(
      (acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] ?? 0) + 1;
        return acc;
      },
      {} as Record<AlertSeverity, number>,
    );

    return Object.entries(counts).reduce((a, b) =>
      b[1] > a[1] ? b : a,
    )[0] as AlertSeverity;
  }

  private getReportSpanDays(report: Report): number | null {
    if (report.period === ReportPeriod.CUSTOM) {
      if (!(report.startDate && report.endDate)) return null;

      return Math.ceil(
        (report.endDate.getTime() - report.startDate.getTime()) |
          (1000 * 60 * 60 * 24),
      );
    } else if (report.period === ReportPeriod.WEEKLY) {
      return 7;
    } else {
      return 30;
    }
  }
}
