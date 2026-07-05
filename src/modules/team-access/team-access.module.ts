import { forwardRef, Module } from '@nestjs/common';
import { TeamAccessService } from './team-access.service';
import { TeamAccessController } from './team-access.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InverterMember } from './entities/inverter-members.entity';
import { InverterMemberModelAction } from './action/inverter-member.action';
import { InvertersModule } from '../inverters/inverters.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InverterMember]),
    forwardRef(() => InvertersModule),
    forwardRef(() => UsersModule),
    EmailModule,
  ],
  providers: [TeamAccessService, InverterMemberModelAction],
  controllers: [TeamAccessController],
  exports: [InverterMemberModelAction, TeamAccessService],
})
export class TeamAccessModule {}
