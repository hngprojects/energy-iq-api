import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModelAction } from './actions/users.action';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InvertersModule } from '../inverters/inverters.module';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsModelAction } from './actions/user-settings.action';
import { ProfileImage } from './entities/profile-img.entity';
import { ProfileImageModelAction } from './actions/profile-img.action';
import { Session } from './entities/sessions.entity';
import { SessionModelAction } from './actions/sessions.action';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSettings, ProfileImage, Session]),
    InvertersModule,
  ],
  controllers: [UsersController],
  providers: [
    UserModelAction,
    UserSettingsModelAction,
    ProfileImageModelAction,
    UsersService,
    SessionModelAction,
  ],
  exports: [UsersService, UserModelAction, SessionModelAction],
})
export class UsersModule {}
