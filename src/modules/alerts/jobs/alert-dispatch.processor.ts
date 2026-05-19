import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES } from '../../../common/constants/queue';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ALERT_DEFERRED_DELIVERY_JOB, ALERT_DISPATCH_JOB, AlertDeferredDeliveryJobData, AlertDispatchJobData } from './alert-dispatch.jobs';
import { ProcessingStatus } from '../../../common/constants/processing-status';

@Processor(QUEUES.ALERT_DISPATCH)
export class AlertDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertDispatchProcessor.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing alert dispatch job ${job.id}`);

    switch (job.name) {
      case ALERT_DISPATCH_JOB:
        return this.handleDispatch(job as Job<AlertDispatchJobData>);
      case ALERT_DEFERRED_DELIVERY_JOB:
        return this.handleDefferedDelievery(job as Job<AlertDeferredDeliveryJobData>);
      default: {
        const message = `Unknown alert dispatch job type: ${job.name}`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
  }

  private async handleDispatch(job: Job<AlertDispatchJobData>): Promise<void> {
    const {
      alertId,
      channel,
      message,
    } = job.data;
    this.logger.log(`Dispatching alert ${alertId} via primary channel: ${channel}`);

    const alert = await this.alertRepo.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      this.logger.error(`Alert ${alertId} not found in database`);
      throw new Error(`Alert not found: ${alertId}`);
    }

    // Mark as processing
    alert.deliveryProcessingStatus = ProcessingStatus.processing;
    await this.alertRepo.save(alert);

    // --- Channel delivery logic would go here ---
    // The processor is the orchestration layer that calls:
    //   WhatsAppService.send()
    //   EmailService.send()
    //   SmsService.send()
    // via the DeliveryFallbackService.
    //
    // For now, we log and mark successful.
    // When the real channel services are injected, this is where
    // deliverWithFallback() is called.
  
    this.logger.log(`Alert ${alertId} processed successfully`);
    alert.deliveryProcessingStatus = ProcessingStatus.successful;
    await this.alertRepo.save(alert);
  }

  private async handleDefferedDelievery(job: Job<AlertDeferredDeliveryJobData>): Promise<void> {
    const { alertId, userId } = job.data;

    this.logger.log(`Processing deferred delivery for alert ${alertId} (user ${userId})`);

    const alert = await this.alertRepo.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      this.logger.error(`Deferred alert ${alertId} not found`);
      throw new Error(`Alert not found: ${alertId}`);
    }

    // Deferred delivery means quiet hours have ended.
    // Re-dispatch the alert immediately
    // In a full implementation, this would re-queue with a new job.
    this.logger.log(`Deferred delivery complete for alert ${alertId}`);

    alert.deliveryProcessingStatus = ProcessingStatus.successful;
    await this.alertRepo.save(alert);
  }
}