import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common/pipes/parse-uuid.pipe';
import { InvertersMetricsService } from './inverters-metrics.service';

@ApiTags('Inverter Metrics')
@ApiBearerAuth()
@Controller({ path: 'inverter-metrics', version: '1' })
export class InvertersMetricsController {
  constructor(private readonly metricsService: InvertersMetricsService) {}

  @Get(':inverterId/dashboard')
  @ApiOperation({ summary: 'Get dashboard metrics for an inverter' })
  getDashboardMetrics(@Param('inverterId', ParseUUIDPipe) inverterId: string) {
    return this.metricsService.getDashboardMetrics(inverterId);
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
}
