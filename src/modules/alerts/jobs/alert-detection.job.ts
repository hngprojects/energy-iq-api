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
    this.logger.debug(
      `AlertDetectionJob: received message on channel ${channel} (${message.length} bytes)`,
    );
    let metric: NormalisedMetric;
    try {
      metric = JSON.parse(message) as NormalisedMetric;
    } catch {
      this.logger.error(
        `AlertDetectionJob: failed to parse message on channel ${channel}`,
      );
      return;
    }

    this.logger.log(
      `AlertDetectionJob: parsed metric for inverter ${metric.inverterId}, SOC=${metric.batterySoc}`,
    );
    void this.evaluateFromMetric(metric);
  }

  private async evaluateFromMetric(metric: NormalisedMetric): Promise<void> {
    this.logger.log(
      `AlertDetectionJob: evaluating inverter ${metric.inverterId}`,
    );
    const inverter = await this.inverterRepo.findOne({
      where: { id: metric.inverterId },
    });

    if (!inverter) {
      this.logger.warn(
        `AlertDetectionJob: inverter ${metric.inverterId} not found in DB`,
      );
      return;
    }

    this.logger.log(
      `AlertDetectionJob: inverter ${inverter.id} found, isActive=${inverter.isActive}`,
    );

    if (!inverter.isActive) {
      this.logger.log(
        `AlertDetectionJob: inverter ${inverter.id} is inactive, skipping`,
      );
      return;
    }

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

      this.logger.log(
        `AlertDetectionJob: settings for user ${inverter.userId}: ${settings ? `found (threshold=${settings.depletionThreshold}, cooldown=${settings.alertCooldownMinutes})` : 'not found, using defaults'}`,
      );

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

      this.logger.log(
        `AlertDetectionJob: depletion input: SOC=${depletionInput.batterySocPercent}%, load=${depletionInput.loadKw}kW, solar=${depletionInput.solarGenKw}kW, capacity=${depletionInput.batteryCapacityKwh}kWh, threshold=${threshold}%`,
      );

      const depletionResult = calculateDepletion(depletionInput, threshold);

      this.logger.log(
        `AlertDetectionJob: depletion result: minutesUntilDepletion=${depletionResult.minutesUntilDepletion}, isCharging=${depletionResult.isCharging}, netDischargeKw=${depletionResult.netDischargeKw}`,
      );

      const alertInfo = shouldFireAlert(
        depletionResult.minutesUntilDepletion,
        depletionResult.isCharging,
      );

      if (!alertInfo) {
        this.logger.log(
          `AlertDetectionJob: no alert needed for inverter ${inverter.id} (safe zone or charging)`,
        );
        return;
      }

      this.logger.log(
        `AlertDetectionJob: alert needed — severity=${alertInfo.severity}, minutes=${alertInfo.minutesUntilDepletion}`,
      );

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
        metadata: {
          alertReason: alertInfo.message,
          batterySoc: depletionInput.batterySocPercent,
          dischargeRate: depletionResult.netDischargeKw,
          timeToEmpty:
            depletionResult.minutesUntilDepletion !== null &&
            depletionResult.minutesUntilDepletion > 0
              ? `${Math.round(depletionResult.minutesUntilDepletion)} min`
              : 'Now',
          // WARNING template fields: battery depletion warning needs these fields
          alertTitle: 'Battery depletion warning',
          stats: [
            {
              label: 'Battery SOC',
              value: `${depletionInput.batterySocPercent}%`,
            },
            {
              label: 'Discharge rate',
              value: `${depletionResult.netDischargeKw} kW`,
            },
            {
              label: 'Time to threshold',
              value:
                depletionResult.minutesUntilDepletion !== null &&
                depletionResult.minutesUntilDepletion > 0
                  ? `${Math.round(depletionResult.minutesUntilDepletion)} min`
                  : 'Now',
            },
          ],
        },
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
