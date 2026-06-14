import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModelAction } from './actions/users.action';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InvertersModule } from '../inverters/inverters.module';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsModelAction } from './actions/user-settings.action';
import { CloudinaryService } from './cloudinary.service';
import { UploadedImgModelAction } from './actions/uploaded-img.action';
import { UploadedImage } from './entities/uploaded-img.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSettings, UploadedImage]),
    InvertersModule,
  ],
  controllers: [UsersController],
  providers: [
    CloudinaryService,
    UserModelAction,
    UserSettingsModelAction,
    UploadedImgModelAction,
    UsersService,
  ],
  exports: [UsersService, UserModelAction],
})
export class UsersModule {}
