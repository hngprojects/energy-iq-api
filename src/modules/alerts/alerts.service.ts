import {
  Inject,
  Injectable,
  Logger,
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
import { InverterMetricsModelAction } from '../inverters-metrics/actions/inverter-metrics.action';
import { UserModelAction } from '../users/actions/users.action';
import { Cron } from '@nestjs/schedule';
import { InvertersMetrics } from '../inverters-metrics/entities/inverters-metrics.entity';
import { CRON_JOB_LABELS } from '../../common/constants/cron-job-labels';
import { GetAlertsDto } from './dto/get-alerts-dto';
import { type ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';
import { ProcessingStatus } from '../../common/constants/processing-status';
import { alertMessages } from './helpers/alert-messages';
import { AlertDeliveryService } from './alert-delivery.service';

@Injectable()
export class AlertsService {
  //logger added
  private readonly logger = new Logger(AlertsService.name);
  constructor(
    private readonly alertAction: AlertModelAction,
    private readonly alertDeliveryService: AlertDeliveryService,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
    private readonly inverterMetricsAction: InverterMetricsModelAction,
    private readonly userModelAction: UserModelAction,
  ) { }

  async getAlerts(dto: GetAlertsDto) {
    const findOptions: FindOptionsWhere<Alert> = {
      userId: dto.userId,
    };
    if (dto.alert_type) findOptions.type = dto.alert_type;
    const alerts = await this.alertAction.find({
      findOptions,
      ...noTransaction(),
      paginationPayload: {
        limit: dto.page_size ?? 10,
        page: dto.page_number ?? 1,
      },
    });
    return alerts;
  }

  async getAlertsSummary(userId: string): Promise<AlertSummaryDto> {
    const activeAlertCount = await this.alertAction.getAlertCountWhere({
      userId,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
    });
    const criticalAlertCount = await this.alertAction.getAlertCountWhere({
      userId,
      severity: AlertSeverity.CRITICAL,
    });
    const warningAlertCount = await this.alertAction.getAlertCountWhere({
      userId,
      severity: AlertSeverity.WARNING,
    });
    const unresolvedCount = await this.alertAction.getAlertCountWhere({
      userId,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
    });
    return {
      active: Number(activeAlertCount),
      critical: Number(criticalAlertCount),
      unresolved: Number(unresolvedCount),
      warning: Number(warningAlertCount),
    };
  }

  async getAlertDetails(dto: GetAlertDetailsDto) {
    //logger added
    this.logger.log(`Fetching alert details`);
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) {
      //Logger added
      this.logger.warn(`Alert not found`);
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }
    if (alert?.userId !== dto.userId) {
      //logger added
      this.logger.warn(`Unauthorized alert access attempt`);
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);
    }

    return alert;
  }

  async resolveAlert(dto: ResolveAlertDetailsDto) {
    //logger added
    this.logger.log(`Resolving alert`);
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) {
      //logger added 
      this.logger.warn(`Alert not found for resolution`);
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }

    if (alert?.userId !== dto.userId){
      //logger added
      this.logger.warn(`Unauthorized alert resolution attempt`);
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);
    }
      
    return await this.alertAction.markAsResolved(dto.alertId);
  }

  @Cron('*/2 * * * * *', { name: CRON_JOB_LABELS.SCAN_ALERTS }) // every two minutes
  async scanAlerts() {
    //logger added
    this.logger.log(`Alert scan cron job triggered`);
    let twoMinutesAgo = new Date().getTime();
    twoMinutesAgo = twoMinutesAgo - 120_000; // 120_000 is two minutes in milliseconds

    const metrics = await this.inverterMetricsAction.getMetricsCreatedSince(
      new Date(twoMinutesAgo),
    );
    const alerts = await this.generateAlertsFromMetrics(metrics);
    //logger added
    this.logger.log(`Generated ${alerts.length} alert(s) from ${metrics.length} metric(s)`);
    for (const alert of alerts) {
      this.alertDeliveryService.deliverAlertViaWhatsapp(alert);
    }
  }

  private async generateAlertsFromMetrics(metrics: InvertersMetrics[]) {
    const alerts: Partial<Alert>[] = [];

    for (const metric of metrics) {
      if (metric.batterySocPercent < this.appCfg.criticalBatteryThreshold) {
        const alert = {
          userId: metric.inverter.userId,
          type: AlertType.BATTERY_PERCENTAGE,
          platform: metric.inverter.brand.toLowerCase(),
          severity: AlertSeverity.CRITICAL,
          message: alertMessages.batteryLevelCritical,
          resolutionStatus: AlertResolutionStatus.UNRESOLVED,
          triggeredAt: metric.metricTimestamp,
          isActive: true,
          deliveryProcesingStatus: ProcessingStatus.pending,
        };

        await this.appendAlertIfExisting(alert as Alert, alerts);
        await this.alertAction.createalert(alert);
        //logger added
        this.logger.warn(`Critical battery alert created — platform: ${metric.inverter.brand}`);
      } else if (metric.batterySocPercent < this.appCfg.lowBatteryThreshold) {
        const alert = {
          userId: metric.inverter.userId,
          type: AlertType.BATTERY_PERCENTAGE,
          platform: metric.inverter.brand.toLowerCase(),
          severity: AlertSeverity.HIGH,
          message: alertMessages.batteryLevelCritical,
          resolutionStatus: AlertResolutionStatus.UNRESOLVED,
          triggeredAt: metric.metricTimestamp,
          isActive: true,
          deliveryProcesingStatus: ProcessingStatus.pending,
        };

        await this.appendAlertIfExisting(alert as Alert, alerts);
        await this.alertAction.createalert(alert);
        //logger added
        this.logger.warn(`Low battery alert created — platform: ${metric.inverter.brand}`);
      }
      if (
        metric.batteryTemperatureC &&
        metric.batteryTemperatureC > this.appCfg.highBatteryTemperatureThreshold
      ) {
        const alert = {
          userId: metric.inverter.userId,
          type: AlertType.BATTERY_TEMPERATURE,
          platform: metric.inverter.brand.toLowerCase(),
          severity: AlertSeverity.HIGH,
          message: alertMessages.batteryLevelCritical,
          resolutionStatus: AlertResolutionStatus.UNRESOLVED,
          triggeredAt: metric.metricTimestamp,
          isActive: true,
          deliveryProcesingStatus: ProcessingStatus.pending,
        };

        await this.appendAlertIfExisting(alert as Alert, alerts);
        await this.alertAction.createalert(alert);
        //logger added
        this.logger.warn(`High battery temperature alert created — platform: ${metric.inverter.brand}`);
      }
    }

    return alerts;
  }

  private async appendAlertIfExisting(alert: Alert, alerts: Partial<Alert>[]) {
    const existingAlert = await this.alertAction.get({
      identifierOptions: {
        type: alert.type,
        severity: alert.severity,
        resolutionStatus: alert.resolutionStatus!,
      },
    });
    if (!existingAlert) alerts.push(alert);
  }
}
