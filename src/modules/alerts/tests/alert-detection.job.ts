import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Inverter } from '../../inverters/entities/inverters.entity';
import { InvertersMetrics } from '../../inverters-metrics/entities/inverters-metrics.entity';
import { UserSettings } from '../../users/entities/user-settings.entity';
import { Alert } from '../entities/alert.entity';
import { calculateDepletion, DepletionInput } from './depletion-engine';
import { isWithinQuietHours, convertToUTC } from './quiet-hours';
import { DuplicateSuppressionService } from './duplicate-suppression';
import { QUEUES } from '../../../common/constants/queue';
import { AlertType, AlertSeverity, AlertResolutionStatus } from '../../../common/enums';
import { ProcessingStatus } from '../../../common/constants/processing-status';
import { ALERT_DEFERRED_DELIVERY_JOB } from './alert-dispatch.jobs';

@Injectable()
export class AlertDetectionJob {
  private readonly logger = new Logger(AlertDetectionJob.name);

  constructor(
    @InjectRepository(Inverter)
    private readonly inverterRepo: Repository<Inverter>,
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepo: Repository<InvertersMetrics>,
    @InjectRepository(UserSettings)
    private readonly userSettingsRepo: Repository<UserSettings>,
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    private readonly duplicateSuppression: DuplicateSuppressionService,
    @InjectQueue(QUEUES.ALERT_DISPATCH)
    private readonly alertQueue: Queue,
  ) {}

  @Cron('*/5 * * * * *', { name: 'alert-detection' })
  async evaluateAllInverters(): Promise<void> {
    this.logger.log('Starting alert evaluation cycle');

    const activeInverters = await this.inverterRepo.find({
      where: { isActive: true },
    });

    this.logger.log(`Found ${activeInverters.length} active inverter(s)`);

    const BATCH_SIZE = 20;
    for (let i = 0; i < activeInverters.length; i += BATCH_SIZE) {
      const batch = activeInverters.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((inverter) => this.evaluateInverter(inverter)),
      );
    }

    this.logger.log('Alert evaluation cycle complete');
  }

  private async evaluateInverter(inverter: Inverter): Promise<void> {
    try {
      // Fetch latest metric within last 30 minutes
      const latestMetric = await this.metricsRepo.findOne({
        where: {
          inverterId: inverter.id,
          createdAt: MoreThan(new Date(Date.now() - 30 * 60 * 1000)),
        },
        order: { createdAt: 'DESC' },
      });

      if (!latestMetric) {
        this.logger.warn(`No recent metrics for inverter ${inverter.id}`);
        return;
      }

      // Fetch user settings (may not have all fields yet)
      const settings = await this.userSettingsRepo.findOne({
        where: { user: { id: inverter.userId } },
      });

      const threshold = settings?.depletionThreshold ?? 10;
      const cooldown = settings?.alertCooldownMinutes ?? 15;
      const timezone = settings?.timezone ?? '+00:00';

      // Build depletion input — use panelCapacityKw as inverter rated power
      const depletionInput: DepletionInput = {
        batterySocPercent: latestMetric.batterySocPercent,
        loadKw: latestMetric.loadKw,
        batteryCapacityKwh: Number(inverter.ratedCapacityKwh),
        solarGenKw: latestMetric.solarGenKw,
        inverterRatedPowerKw: Number(inverter.panelCapacityKw),
      };

      const depletionResult = calculateDepletion(depletionInput, threshold);

      // Determine if alert should fire
      const alertInfo = this.shouldFireAlert(depletionResult);
      if (!alertInfo) {
        return;
      }

      // Check duplicate suppression
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

      // Check quiet hours
      const now = new Date();
      let deferDelivery = false;

      if (settings?.quietHoursStart && settings?.quietHoursEnd) {
        const utcStart = convertToUTC(settings.quietHoursStart, timezone);
        const utcEnd = convertToUTC(settings.quietHoursEnd, timezone);
        deferDelivery = isWithinQuietHours(now, utcStart, utcEnd);
      }

      // Critical alerts bypass quiet hours
      if (alertInfo.severity === AlertSeverity.CRITICAL) {
        deferDelivery = false;
      }

      // Create the alert
      const newAlert = this.alertRepo.create({
        userId: inverter.userId,
        type: AlertType.BATTERY_PERCENTAGE,
        platform: inverter.brand.toLowerCase(),
        severity: alertInfo.severity as AlertSeverity,
        message: alertInfo.message,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
        triggeredAt: new Date(),
        isActive: true,
        deliveryProcessingStatus: ProcessingStatus.pending,
        deliverable: !deferDelivery,
        deliveryStatus: 'pending',
      });

      const savedAlert = await this.alertRepo.save(newAlert);

      // Queue for delivery (if not deferred)
      if (!deferDelivery) {
        await this.alertQueue.add('alert.dispatch', {
          alertId: savedAlert.id,
          userId: savedAlert.userId,
          type: savedAlert.type,
          severity: savedAlert.severity,
          message: savedAlert.message,
          channel: 'whatsapp', // primary channel
        });
      }

      this.logger.log(
        `Alert created for user ${inverter.userId}: ${alertInfo.severity} - ${alertInfo.message}` +
          (deferDelivery ? ' (deferred due to quiet hours)' : ''),
      );

      // If deferred, we would schedule a job for later delivery
      if (deferDelivery) {
        // Schedule deferred delivery when quiet hours end
        if (settings?.quietHoursEnd && settings?.timezone) {
          const utcEnd = convertToUTC(settings.quietHoursEnd, settings.timezone);
          const [endH, endM] = utcEnd.split(':').map(Number);
          const quietHoursEndDate = new Date(now);
          quietHoursEndDate.setUTCHours(endH, endM, 0, 0);

          // If quiet hours end is in the past for today, schedule for tomorrow
          if (quietHoursEndDate <= now) {
            quietHoursEndDate.setUTCDate(quietHoursEndDate.getUTCDate() + 1);
          }

          const delay = quietHoursEndDate.getTime() - now.getTime();

          await this.alertQueue.add(ALERT_DEFERRED_DELIVERY_JOB, {
            alertId: savedAlert.id,
            userId: savedAlert.userId,
            scheduledFor: quietHoursEndDate.toISOString(),
          }, {
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          });

          this.logger.log(`Scheduled deferred delivery for alert ${savedAlert.id} at ${quietHoursEndDate.toISOString()}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error evaluating inverter ${inverter.id}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Determine if an alert should be fired based on depletion calculation.
   * Returns null if safe (no alert needed).
   */
  shouldFireAlert(
    depletionResult: ReturnType<typeof calculateDepletion>,
  ): { severity: string; message: string } | null {
    if (depletionResult.isCharging || depletionResult.minutesUntilDepletion === null) {
      return null; // System is charging or idle
    }

    if (depletionResult.minutesUntilDepletion < 30) {
      return {
        severity: AlertSeverity.CRITICAL,
        message: `Battery depletion imminent — approximately ${Math.round(depletionResult.minutesUntilDepletion)} minutes remaining. Consider reducing load or switching to grid.`,
      };
    }

    if (depletionResult.minutesUntilDepletion <= 60) {
      return {
        severity: AlertSeverity.WARNING,
        message: `Battery may deplete in approximately ${Math.round(depletionResult.minutesUntilDepletion)} minutes. Monitor your usage.`,
      };
    }

    return null; // Safe — more than 60 minutes
  }
}