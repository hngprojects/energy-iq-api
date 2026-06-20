import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { QUEUES } from '../../common/constants/queue';
import { EmailProcessor } from './email.processor';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.EMAIL }),
    forwardRef(() => ReportsModule),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
