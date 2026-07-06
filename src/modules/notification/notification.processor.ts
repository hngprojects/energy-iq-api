import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PUSH_JOBS, SendPushJobData } from './notifications.jobs';
import { Inject, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import * as admin from 'firebase-admin';
import { FidMulticastMessage, getMessaging } from 'firebase-admin/messaging';
import { QUEUES } from '../../common/constants/queue';
import { ProcessingStatus } from '../../common/constants/processing-status';
import { type ConfigType } from '@nestjs/config';
import { firebaseConfig } from '../../config/firebase.config';

@Processor(QUEUES.SEND_PUSH)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationsService: NotificationService,
    @Inject(firebaseConfig.KEY)
    private readonly firebaseCfg: ConfigType<typeof firebaseConfig>,
  ) {
    if (!admin.getApps().length) {
      admin.initializeApp({
        credential: admin.cert({
          projectId: firebaseCfg.projectId,
          clientEmail: firebaseCfg.clientEmail,
          privateKey: firebaseCfg.privateKey,
        }),
      });
    }
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case PUSH_JOBS.SEND_PUSH:
        return this.handleSendPush(job as Job<SendPushJobData>);
      default: {
        const message = `Unknown job type: ${job.name}`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
  }

  private async handleSendPush(job: Job<SendPushJobData>): Promise<void> {
    const { userId, notificationId, title, body, data } = job.data;
    const fids = await this.notificationsService.getActiveSessionsFids(userId);

    if (!fids.length) {
      this.logger.log(
        `No active device FIDs for user ${userId} — skipping push delivery`,
      );
      await this.notificationsService.updatePushDeliveryStatus(
        notificationId,
        userId,
        ProcessingStatus.failed,
      );
      return;
    }

    const message: FidMulticastMessage = {
      fids,
      notification: { title, body },
      data: data ?? {},
    };

    try {
      const res = await getMessaging().sendEachForMulticast(message);

      this.logger.log(
        `Push sent for notification ${notificationId}: ` +
          `${res.successCount} succeeded, ${res.failureCount} failed`,
      );

      // Log individual failures for debugging
      if (res.failureCount > 0) {
        res.responses.forEach((r, i) => {
          if (!r.success) {
            this.logger.warn(
              `Push failed for fid[${i}]: ${r.error?.message ?? 'unknown error'}`,
            );
          }
        });
      }

      const status =
        res.failureCount === fids.length
          ? ProcessingStatus.failed
          : ProcessingStatus.successful;

      await this.notificationsService.updatePushDeliveryStatus(
        notificationId,
        userId,
        status,
      );
    } catch (error) {
      this.logger.error(
        `Push delivery failed for notification ${notificationId}`,
        error,
      );
      await this.notificationsService.updatePushDeliveryStatus(
        notificationId,
        userId,
        ProcessingStatus.failed,
      );
      throw error;
    }
  }
}
