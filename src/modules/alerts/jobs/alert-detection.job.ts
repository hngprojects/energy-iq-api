import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Inverter } from '../../inverters/entities/inverters.entity';
import { UserSettings } from '../../users/entities/user-settings.entity';
import { Alert } from '../entities/alert.entity';
import { NormalisedMetric } from '../../inverters/types/shared.types';
import { MetricsPubSubService } from '../../metrics-stream/pubsub/metrics-pubsub.service';
import {
  calculateDepletion,
  DepletionInput,
} from '../helpers/depletion-engine';
import { shouldFireAlert } from '../helpers/alert-thresholds';
import { isWithinQuietHours, convertToUTC } from '../helpers/quiet-hours';
import { DuplicateSuppressionService } from '../helpers/duplicate-suppression';
import { QUEUES } from '../../../common/constants/queue';
import {
  AlertType,
  AlertSeverity,
  AlertResolutionStatus,
} from '../../../common/enums';
import { ProcessingStatus } from '../../../common/constants/processing-status';
import { ALERT_DEFERRED_DELIVERY_JOB } from './alert-dispatch.jobs';

const INVERTER_PATTERN = 'inverter:*';

@Injectable()
export class AlertDetectionJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertDetectionJob.name);

  // Keep a reference to the callback so we can unsubscribe cleanly on shutdown
  private readonly metricHandler: (message: string, channel: string) => void = (
    message: string,
    channel: string,
  ) => this.handleMetricMessage(message, channel);

  constructor(
    @InjectRepository(Inverter)
    private readonly inverterRepo: Repository<Inverter>,
    @InjectRepository(UserSettings)
    private readonly userSettingsRepo: Repository<UserSettings>,
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    private readonly duplicateSuppression: DuplicateSuppressionService,
    private readonly pubSubService: MetricsPubSubService,
    @InjectQueue(QUEUES.ALERT_DISPATCH)
    private readonly alertQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pubSubService.psubscribe(INVERTER_PATTERN, this.metricHandler);
    this.logger.log(
      `AlertDetectionJob: subscribed to pattern "${INVERTER_PATTERN}"`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pubSubService.punsubscribe(INVERTER_PATTERN, this.metricHandler);
    this.logger.log(
      `AlertDetectionJob: unsubscribed from pattern "${INVERTER_PATTERN}"`,
    );
  }

  /**
   * Called by MetricsPubSubService for every message matching inverter:*
   * @param message - JSON-serialised NormalisedMetric
   * @param channel - The exact channel that fired, e.g. "inverter:abc-123"
   */
  private handleMetricMessage(message: string, channel: string): void {
    let metric: NormalisedMetric;
    try {
      metric = JSON.parse(message) as NormalisedMetric;
    } catch {
      this.logger.error(
        `AlertDetectionJob: failed to parse message on channel ${channel}`,
      );
      return;
    }

    void this.evaluateFromMetric(metric);
  }

  private async evaluateFromMetric(metric: NormalisedMetric): Promise<void> {
    const inverter = await this.inverterRepo.findOne({
      where: { id: metric.inverterId },
    });

    if (!inverter) {
      this.logger.warn(
        `AlertDetectionJob: inverter ${metric.inverterId} not found`,
      );
      return;
    }

    if (!inverter.isActive) return;

    await this.evaluateInverter(inverter, metric);
  }

  private async evaluateInverter(
    inverter: Inverter,
    metric: NormalisedMetric,
  ): Promise<void> {
    try {
      const settings = await this.userSettingsRepo.findOne({
        where: { user: { id: inverter.userId } },
      });

      const threshold = settings?.depletionThreshold ?? 10;
      const cooldown = settings?.alertCooldownMinutes ?? 15;
      const timezone = settings?.timezone ?? '+00:00';

      const depletionInput: DepletionInput = {
        batterySocPercent: metric.batterySoc ?? 0,
        loadKw: metric.acOutputPowerKw ?? 0,
        batteryCapacityKwh: Number(inverter.ratedCapacityKwh),
        solarGenKw: metric.solarPowerKw ?? 0,
        inverterRatedPowerKw: Number(inverter.panelCapacityKw),
      };

      const depletionResult = calculateDepletion(depletionInput, threshold);

      const alertInfo = shouldFireAlert(
        depletionResult.minutesUntilDepletion,
        depletionResult.isCharging,
      );
      if (!alertInfo) return;

      const dupCheck = await this.duplicateSuppression.isDuplicate(
        {
          userId: inverter.userId,
          type: AlertType.BATTERY_PERCENTAGE,
          severity: alertInfo.severity,
        },
        cooldown,
      );

      if (dupCheck.isDuplicate) {
        this.logger.log(
          `Suppressed duplicate alert for user ${inverter.userId}: ${dupCheck.reason}`,
        );
        return;
      }

      const now = new Date();
      let deferDelivery = false;

      if (settings?.quietHoursStart && settings?.quietHoursEnd) {
        const utcStart = convertToUTC(settings.quietHoursStart, timezone);
        const utcEnd = convertToUTC(settings.quietHoursEnd, timezone);
        deferDelivery = isWithinQuietHours(now, utcStart, utcEnd);
      }

      if (alertInfo.severity === AlertSeverity.CRITICAL) {
        deferDelivery = false;
      }

      const newAlert: Alert = this.alertRepo.create({
        userId: inverter.userId,
        type: AlertType.BATTERY_PERCENTAGE,
        platform: inverter.brand.toLowerCase(),
        severity: alertInfo.severity,
        message: alertInfo.message,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
        triggeredAt: new Date(),
        isActive: true,
        deliveryProcessingStatus: ProcessingStatus.pending,
        deliverable: !deferDelivery,
        deliveryStatus: 'pending',
      });

      const savedAlert = await this.alertRepo.save(newAlert);

      if (!deferDelivery) {
        await this.alertQueue.add('alert.dispatch', {
          alertId: savedAlert.id,
          userId: savedAlert.userId,
          type: savedAlert.type,
          severity: savedAlert.severity,
          message: savedAlert.message,
          channel: 'whatsapp',
        });
      } else if (settings?.quietHoursEnd && settings?.timezone) {
        const utcEnd = convertToUTC(settings.quietHoursEnd, settings.timezone);
        const [endH, endM] = utcEnd.split(':').map(Number);
        const quietHoursEndDate = new Date(now);
        quietHoursEndDate.setUTCHours(endH, endM, 0, 0);

        if (quietHoursEndDate <= now) {
          quietHoursEndDate.setUTCDate(quietHoursEndDate.getUTCDate() + 1);
        }

        const delay = quietHoursEndDate.getTime() - now.getTime();

        await this.alertQueue.add(
          ALERT_DEFERRED_DELIVERY_JOB,
          {
            alertId: savedAlert.id,
            userId: savedAlert.userId,
            scheduledFor: quietHoursEndDate.toISOString(),
          },
          {
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );

        this.logger.log(
          `Scheduled deferred delivery for alert ${savedAlert.id} at ${quietHoursEndDate.toISOString()}`,
        );
      }

      this.logger.log(
        `Alert created for user ${inverter.userId}: ${alertInfo.severity} — ${alertInfo.message}` +
          (deferDelivery ? ' (deferred: quiet hours)' : ''),
      );
    } catch (error) {
      this.logger.error(
        `Error evaluating inverter ${inverter.id}: ${(error as Error).message}`,
      );
    }
  }

  private async resolveAlertType(): Promise<void> {}
}
