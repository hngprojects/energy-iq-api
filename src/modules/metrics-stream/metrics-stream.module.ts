import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsStreamController } from './metrics-stream.controller';
import { MetricsStreamService } from './metrics-stream.service';
import { MetricsPollerService } from './poller/metrics-poller.service';
import { MetricsPubSubService } from './pubsub/metrics-pubsub.service';
import { InvertersMetrics } from '../inverters-metrics/entities/inverters-metrics.entity';
import { InvertersModule } from '../inverters/inverters.module';
import { InvertersMetricsModule } from '../inverters-metrics/inverters-metrics.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([InvertersMetrics]),
    InvertersModule,
    InvertersMetricsModule,
  ],
  controllers: [MetricsStreamController],
  providers: [MetricsStreamService, MetricsPollerService, MetricsPubSubService],
  exports: [MetricsPubSubService],
})
export class MetricsStreamModule {}
