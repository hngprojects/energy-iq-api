import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvertersModule } from '../inverters/inverters.module';
import { Report } from './entities/report.entity';
import { User } from '../users/entities/user.entity';
import { UserSettings } from '../users/entities/user-settings.entity';
import { Alert } from '../alerts/entities/alert.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportProcessor } from './reports.processor';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queue';
import { UsersModule } from '../users/users.module';
import { InvertersMetricsModule } from '../inverters-metrics/inverters-metrics.module';
import { AlertsModule } from '../alerts/alerts.module';
import { ReportModelAction } from './action/report.action';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, User, UserSettings, Alert]),
    BullModule.registerQueue({ name: QUEUES.REPORT_DISPATCH }),
    InvertersModule,
    UsersModule,
    InvertersMetricsModule,
    AlertsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportProcessor, ReportModelAction],
  exports: [ReportModelAction, ReportsService]
})
export class ReportsModule {}
