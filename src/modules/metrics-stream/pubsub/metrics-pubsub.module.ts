import { Module } from '@nestjs/common';
import { MetricsPubSubService } from './metrics-pubsub.service';

/**
 * Standalone module that provides and exports MetricsPubSubService.
 * Extracted to avoid a circular dependency between InvertersModule
 * (which needs to publish control events) and MetricsStreamModule
 * (which needs InvertersModule for the poller adapters).
 */
@Module({
  providers: [MetricsPubSubService],
  exports: [MetricsPubSubService],
})
export class MetricsPubSubModule {}
