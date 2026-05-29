import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { MetricsStreamController } from './metrics-stream.controller';
import { MetricsStreamService } from './metrics-stream.service';
import { MetricsPollerService } from './poller/metrics-poller.service';
import { MetricsPubSubModule } from './pubsub/metrics-pubsub.module';
import { InvertersMetrics } from '../inverters-metrics/entities/inverters-metrics.entity';
import { InvertersModule } from '../inverters/inverters.module';
import { InvertersMetricsModule } from '../inverters-metrics/inverters-metrics.module';
import { UserSettings } from '../users/entities/user-settings.entity';
import { Alert } from '../alerts/entities/alert.entity';
import { QUEUES } from '../../common/constants/queue';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([InvertersMetrics, UserSettings, Alert]),
    BullModule.registerQueue({ name: QUEUES.ALERT_DISPATCH }),
    InvertersModule,
    InvertersMetricsModule,
    MetricsPubSubModule,
  ],
  controllers: [MetricsStreamController],
  providers: [MetricsStreamService, MetricsPollerService],
  exports: [MetricsPubSubModule],
})
export class MetricsStreamModule {}
