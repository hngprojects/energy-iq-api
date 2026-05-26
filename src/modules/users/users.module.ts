import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModelAction } from './actions/users.action';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InvertersModule } from '../inverters/inverters.module';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsModelAction } from './actions/user-settings.action';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserSettings]), InvertersModule],
  controllers: [UsersController],
  providers: [UserModelAction, UserSettingsModelAction, UsersService],
  exports: [UsersService, UserModelAction],
})
export class UsersModule {}
