import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Alert } from './entities/alert.entity';
import { AlertModelAction } from './actions/alert.action';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertDetectionJob } from './jobs/alert-detection.job';
import { AlertDispatchProcessor } from './jobs/alert-dispatch.processor';
import { DuplicateSuppressionService } from './helpers/duplicate-suppression';
import { Inverter } from '../inverters/entities/inverters.entity';
import { UserSettings } from '../users/entities/user-settings.entity';
import { User } from '../users/entities/user.entity';
import { MetricsStreamModule } from '../metrics-stream/metrics-stream.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { QUEUES } from '../../common/constants/queue';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, Inverter, UserSettings, User]),
    BullModule.registerQueue({ name: QUEUES.ALERT_DISPATCH }),
    MetricsStreamModule,
    WhatsappModule,
    forwardRef(() => EmailModule),
  ],
  providers: [
    AlertsService,
    AlertDetectionJob,
    AlertDispatchProcessor,
    AlertModelAction,
    DuplicateSuppressionService,
  ],
  controllers: [AlertsController],
  exports: [AlertModelAction, AlertsService, DuplicateSuppressionService],
})
export class AlertsModule {}
