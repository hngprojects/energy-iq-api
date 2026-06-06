import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Waitlist } from './entities/waitlist.entity';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { WaitlistModelAction } from './actions/waitlist.action';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule, TypeOrmModule.forFeature([User, Waitlist])],
  controllers: [WaitlistController],
  providers: [WaitlistModelAction, WaitlistService],
  exports: [WaitlistModelAction, WaitlistService],
})
export class WaitlistModule {}
