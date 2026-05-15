import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert-entity';
import { AlertModelAction } from './actions/alert.action';

@Module({
  exports: [AlertModelAction],
  imports: [TypeOrmModule.forFeature([Alert])],
  providers: [AlertModelAction],
})
export class AlertsModule {}
