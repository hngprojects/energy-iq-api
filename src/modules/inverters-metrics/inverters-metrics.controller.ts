import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common/pipes/parse-uuid.pipe';
import { InvertersMetricsService } from './inverters-metrics.service';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('Inverter Metrics')
@ApiBearerAuth()
@Controller({ path: 'inverter-metrics', version: '1' })
export class InvertersMetricsController {
  constructor(private readonly metricsService: InvertersMetricsService) {}

  @Get(':inverterId/dashboard')
  @ApiOperation({ summary: 'Get dashboard metrics for an inverter' })
  getDashboardMetrics(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metricsService.getDashboardMetrics(inverterId, user.sub);
  }

  @Get(':inverterId/power-consumption')
  @ApiOperation({ summary: 'Get power consumption breakdown by zone' })
  getPowerConsumption(@Param('inverterId', ParseUUIDPipe) inverterId: string) {
    return this.metricsService.getPowerConsumption(inverterId);
  }

  @Get(':inverterId/energy-usage')
  @ApiOperation({ summary: 'Get energy usage chart data' })
  getEnergyUsage(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Query('period')
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    return this.metricsService.getEnergyUsage(inverterId, period);
  }

  @Get(':inverterId/savings')
  @ApiOperation({
    summary: 'Get period or custom-range savings for an inverter',
  })
  getPeriodSavings(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @Query('period')
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (startDate && endDate) {
      return this.metricsService.getCustomRangeSavings(
        inverterId,
        new Date(startDate),
        new Date(endDate),
      );
    }
    return this.metricsService.getPeriodSavings(
      inverterId,
      period,
      new Date(date ?? Date.now()),
    );
  }

  @Get(':inverterId/savings/cumulative')
  @ApiOperation({ summary: 'Get lifetime cumulative savings for an inverter' })
  getCumulativeSavings(@Param('inverterId', ParseUUIDPipe) inverterId: string) {
    return this.metricsService.getCumulativeSavings(inverterId);
  }
}
