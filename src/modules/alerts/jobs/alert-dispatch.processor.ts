import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES } from '../../../common/constants/queue';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { Inject, Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ALERT_DEFERRED_DELIVERY_JOB,
  ALERT_DISPATCH_JOB,
  AlertDeferredDeliveryJobData,
  AlertDispatchJobData,
} from './alert-dispatch.jobs';
import { ProcessingStatus } from '../../../common/constants/processing-status';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { EmailService } from '../../email/email.service';
import { User } from '../../users/entities/user.entity';
import { UserSettings } from '../../users/entities/user-settings.entity';
import { formatAlertMessage } from '../helpers/whatsapp-helpers';
import { deliverWithFallback } from '../fallback.service';
import { SYS_MSG } from '../../../common/constants/sys-msg';
import { appConfig } from '../../../config/app.config';
import { type ConfigType } from '@nestjs/config';

@Processor(QUEUES.ALERT_DISPATCH)
export class AlertDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertDispatchProcessor.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly userSettingsRepo: Repository<UserSettings>,
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing alert dispatch job ${job.id}`);

    switch (job.name) {
      case ALERT_DISPATCH_JOB:
        return this.handleDispatch(job as Job<AlertDispatchJobData>);
      case ALERT_DEFERRED_DELIVERY_JOB:
        return this.handleDeferredDelivery(
          job as Job<AlertDeferredDeliveryJobData>,
        );
      default: {
        const message = `Unknown alert dispatch job type: ${job.name}`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
  }

  private async handleDispatch(job: Job<AlertDispatchJobData>): Promise<void> {
    const { alertId, userId, severity, type, dashboardUrl } = job.data;

    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      this.logger.error(`Alert ${alertId} not found`);
      throw new Error(`Alert not found: ${alertId}`);
    }

    const [user, settings] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.userSettingsRepo.findOne({ where: { user: { id: userId } } }),
    ]);

    if (!user) {
      this.logger.error(`User ${userId} not found for alert ${alertId}`);
      throw new Error(`User not found: ${userId}`);
    }

    alert.deliveryProcessingStatus = ProcessingStatus.processing;
    await this.alertRepo.save(alert);

    const formattedMessage = formatAlertMessage({
      type,
      severity,
      message: alert.message,
    });

    const whatsappEnabled = !!(user.phoneNumber && settings?.whatsappAlerts);
    const emailEnabled = settings?.emailAlerts ?? true; // default to email if no settings

    this.logger.debug(
      `Alert ${alertId} channel eligibility — whatsapp: ${whatsappEnabled} (phone=${!!user.phoneNumber}, setting=${settings?.whatsappAlerts}), email: ${emailEnabled} (setting=${settings?.emailAlerts})`,
    );

    const result = await deliverWithFallback(
      {
        alertId,
        userId,
        message: formattedMessage,
        channels: ['whatsapp', 'email'],
        userSettings: {
          whatsappAlerts: whatsappEnabled,
          emailAlerts: emailEnabled,
          smsNotification: false,
        },
      },
      {
        whatsapp: {
          send: ({ message }) =>
            this.whatsappService
              .sendText(user.phoneNumber!, message)
              .then(() => undefined),
        },
        email: {
          send: (_details) => {
            const meta = alert.metadata ?? {};
            const resolveLink: string =
              typeof meta['resolveLink'] === 'string'
                ? meta['resolveLink']
                : (dashboardUrl ?? this.appCfg.clientUrl);
            const alertReason: string =
              typeof meta['alertReason'] === 'string'
                ? meta['alertReason']
                : formattedMessage;
            const batterySoc =
              typeof meta['batterySoc'] === 'number'
                ? meta['batterySoc']
                : undefined;
            const dischargeRate =
              typeof meta['dischargeRate'] === 'number'
                ? meta['dischargeRate']
                : undefined;
            const timeToEmpty =
              typeof meta['timeToEmpty'] === 'string'
                ? meta['timeToEmpty']
                : undefined;
            const stats = Array.isArray(meta['stats'])
              ? // ? (meta['stats'] as { label: string; value: string }[])
                // : undefined;
                (meta['stats'] as unknown[]).filter(
                  (s): s is { label: string; value: string } =>
                    typeof s === 'object' &&
                    s !== null &&
                    typeof (s as Record<string, unknown>)['label'] ===
                      'string' &&
                    typeof (s as Record<string, unknown>)['value'] === 'string',
                )
              : undefined;
            const alertTitle =
              typeof meta['alertTitle'] === 'string'
                ? meta['alertTitle']
                : undefined;
            return this.emailService.sendAlert(
              user.email,
              user.firstName,
              type,
              severity,
              alertReason,
              resolveLink,
              { batterySoc, dischargeRate, timeToEmpty, stats, alertTitle },
            );
          },
        },
      },
    );

    this.logger.log(
      `Alert ${alertId} delivery result: ${result.status} via ${result.channelUsed ?? 'none'} — audit: ${result.audit.join(' | ')}`,
    );

    if (result.status === 'delivered') {
      alert.deliveryProcessingStatus = ProcessingStatus.successful;
      alert.deliveryStatus = 'delivered';
      alert.deliveryChannel = result.channelUsed ?? undefined;
      await this.alertRepo.save(alert);
    } else {
      alert.deliveryProcessingStatus = ProcessingStatus.failed;
      alert.deliveryStatus = 'failed';
      await this.alertRepo.save(alert);
      this.logger.error(
        `All delivery channels failed for alert ${alertId} (user ${userId})`,
      );
      throw new Error(`Delivery failed for alert ${alertId}`);
    }
  }

  private async handleDeferredDelivery(
    job: Job<AlertDeferredDeliveryJobData>,
  ): Promise<void> {
    const { alertId, userId } = job.data;

    this.logger.log(
      `Processing deferred delivery for alert ${alertId} (user ${userId})`,
    );
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException(SYS_MSG.ALERT_NOT_FOUND);
    }
    await this.handleDispatch({
      data: {
        alertId,
        userId,
        type: alert?.type,
        severity: alert.severity,
        message: alert.message,
        channel: 'whatsapp',
      },
    } as Job<AlertDispatchJobData>);
  }
}
