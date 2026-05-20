import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { QUEUES } from '../../common/constants/queue';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.EMAIL })],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
