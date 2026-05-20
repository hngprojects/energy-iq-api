import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from '../../config/app.config';
import { InvertersController } from './inverters.controller';
import { InvertersService } from './inverters.service';
import { Inverter } from './entities/inverters.entity';
import { GrowattAdapter } from './adapters/growatt.adapter';
import { SunsynkAdapter } from './adapters/sunsynk.adapter';
import { VictronAdapter } from './adapters/victron.adapters';
import { SandboxAdapter } from './adapters/sandbox.adapter';
import { InverterModelAction } from './action/inverters.action';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inverter]),
    ConfigModule.forFeature(appConfig),
  ],
  controllers: [InvertersController],
  providers: [
    InvertersService,
    InverterModelAction,
    VictronAdapter,
    GrowattAdapter,
    SunsynkAdapter,
    SandboxAdapter,
  ],
  exports: [
    InvertersService,
    InverterModelAction,
    VictronAdapter,
    GrowattAdapter,
    SunsynkAdapter,
    SandboxAdapter,
  ],
})
export class InvertersModule {}
