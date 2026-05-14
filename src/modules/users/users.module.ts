import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModelAction } from './actions/users.action';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InvertersModule } from '../inverters/inverters.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), InvertersModule],
  controllers: [UsersController],
  providers: [UserModelAction, UsersService],
  exports: [UsersService, UserModelAction],
})
export class UsersModule {}
