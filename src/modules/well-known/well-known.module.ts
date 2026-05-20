import { Module } from '@nestjs/common';
import { WellKnownController } from './well-known.controller';
import { WellKnownService } from './well-known.service';

@Module({
  controllers: [WellKnownController],
  providers: [WellKnownService],
})
export class WellKnownModule {}
