import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity';
import { AlertModelAction } from './actions/alert.action';
import { AlertsController } from './alerts.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { InvertersMetricsModule } from '../inverters-metrics/inverters-metrics.module';
import { UsersModule } from '../users/users.module';
import { AlertDeliveryService } from './alert-delivery.service';
import { AlertsService } from './alerts.service';
import { DuplicateSuppressionService } from './helpers/duplicate-suppression';
import { InvertersMetrics } from '../inverters-metrics/entities/inverters-metrics.entity';
import { Inverter } from '../inverters/entities/inverters.entity';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queue';
import { AlertDetectionJob } from './jobs/alert-detection.job';
import { AlertDispatchProcessor } from './jobs/alert-dispatch.processor';

@Module({
  exports: [AlertModelAction, AlertsService, DuplicateSuppressionService],
  imports: [
    InvertersMetricsModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Alert, Inverter, InvertersMetrics]),
    BullModule.registerQueue({ name: QUEUES.ALERT_DISPATCH }),
    UsersModule,
  ],
  providers: [
    AlertDeliveryService,
    AlertModelAction,
    AlertsService,
    AlertDetectionJob,
    AlertDispatchProcessor,
    DuplicateSuppressionService,
  ],
  controllers: [AlertsController],
})
export class AlertsModule {}
