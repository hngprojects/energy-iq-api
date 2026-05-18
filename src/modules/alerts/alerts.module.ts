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

@Module({
  exports: [AlertModelAction],
  imports: [
    InvertersMetricsModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Alert]),
    UsersModule,
  ],
  providers: [
    AlertDeliveryService,
    AlertModelAction,
    AlertsService,
    AlertsService,
  ],
  controllers: [AlertsController],
})
export class AlertsModule {}
