import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvertersModule } from '../inverters/inverters.module';
import { Report } from './entities/report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportProcessor } from './reports.processor';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../../common/constants/queue';
import { UsersModule } from '../users/users.module';
import { InvertersMetricsModule } from '../inverters-metrics/inverters-metrics.module';
import { AlertsModule } from '../alerts/alerts.module';
import { ReportModelAction } from './action/report.action';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report]),
    BullModule.registerQueue({ name: QUEUES.REPORT_DISPATCH }),
    InvertersModule,
    UsersModule,
    InvertersMetricsModule,
    AlertsModule,
    EmailModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportProcessor, ReportModelAction],
  exports: [ReportModelAction, ReportsService],
})
export class ReportsModule {}
