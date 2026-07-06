import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { UsersModule } from '../users/users.module';
import { NotificationController } from './notification.controller';
import { NotificationModelAction } from './actions/notification.action';
import { JwtModule } from '@nestjs/jwt';
import { jwtConfig } from '../../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { StringValue } from 'ms';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Notification]),
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwt: ConfigType<typeof jwtConfig>) => ({
        secret: jwt.accessSecret,
        signOptions: { expiresIn: jwt.accessExpiresIn as StringValue },
      }),
    }),
  ],
  providers: [
    NotificationGateway,
    NotificationModelAction,
    NotificationService,
  ],
  controllers: [NotificationController],
})
export class NotificationModule {}
