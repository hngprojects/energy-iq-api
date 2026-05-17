import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvertersMetricsController } from './inverters-metrics.controller';
import { InvertersMetricsService } from './inverters-metrics.service';
import { InvertersMetrics } from './entities/inverters-metrics.entity';
import { DailyMetrics } from './entities/daily-metrics.entity';
import { InverterMetricsModelAction } from './actions/inverter-metrics.action';

@Module({
  imports: [TypeOrmModule.forFeature([InvertersMetrics, DailyMetrics])],
  controllers: [InvertersMetricsController],
  providers: [InverterMetricsModelAction, InvertersMetricsService],
  exports: [InverterMetricsModelAction, InvertersMetricsService, TypeOrmModule],
})
export class InvertersMetricsModule {}
