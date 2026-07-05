import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvertersMetricsController } from './inverters-metrics.controller';
import { InvertersMetricsService } from './inverters-metrics.service';
import { InvertersMetrics } from './entities/inverters-metrics.entity';
import { DailyMetrics } from './entities/daily-metrics.entity';
import { InvertersModule } from '../inverters/inverters.module';
import { InverterMetricsModelAction } from './actions/inverter-metrics.action';
import { UserSettings } from '../users/entities/user-settings.entity';
import { TeamAccessModule } from '../team-access/team-access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvertersMetrics, DailyMetrics, UserSettings]),
    forwardRef(() => InvertersModule),
    forwardRef(() => TeamAccessModule),
  ],
  controllers: [InvertersMetricsController],
  providers: [InverterMetricsModelAction, InvertersMetricsService],
  exports: [InverterMetricsModelAction, InvertersMetricsService, TypeOrmModule],
})
export class InvertersMetricsModule {}
