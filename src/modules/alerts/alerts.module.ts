import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity';
import { AlertModelAction } from './actions/alert.action';
import { AlertsController } from './alerts.controller';

@Module({
  exports: [AlertModelAction],
  imports: [TypeOrmModule.forFeature([Alert])],
  providers: [AlertModelAction],
  controllers: [AlertsController],
})
export class AlertsModule {}
