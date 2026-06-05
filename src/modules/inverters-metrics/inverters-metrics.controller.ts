import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
  })
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
    description:
      'For a predefined period, pass `period` (default: daily) and optionally `date` (ISO date, default: today). ' +
      'For a custom range, pass `startDate` and `endDate` — the granularity is auto-selected based on span length. ' +
      'Dates should be in YYYY-MM-DD format.',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['hourly', 'daily', 'weekly', 'monthly'],
    example: 'daily',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2026-05-26',
    description:
      'Reference date for period mode (YYYY-MM-DD). Defaults to today.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-05-14',
    description: 'Start of custom range (YYYY-MM-DD). Use with endDate.',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-05-26',
    description:
      'End of custom range (YYYY-MM-DD, exclusive). Use with startDate.',
  })
  getPeriodSavings(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('period')
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (startDate || endDate) {
      if (!startDate || !endDate) {
        throw new BadRequestException(
          `startDate and endDate must be provided together`,
        );
      }

      // Treat both dates as inclusive day boundaries.
      // new Date("YYYY-MM-DD") parses as UTC midnight, which can cause off-by-one
      // errors in Lagos time (+01:00). We normalise to local midnight explicitly.
      const start = this.metricsService.parseDateOrThrow(startDate, 'startDate');
      start.setHours(0, 0, 0, 0); // start of start day (local)

      const end = this.metricsService.parseDateOrThrow(endDate, 'endDate');
      end.setDate(end.getDate() + 1); // advance to next calendar day
      end.setHours(0, 0, 0, 0);       // midnight of next day = exclusive upper bound

      return this.metricsService.getCustomRangeSavings(
        inverterId,
        user.sub,
        start,
        end,
      );
    }
    // Default date to today when not provided
    const referenceDate = date
      ? this.metricsService.parseDateOrThrow(date, 'date')
      : new Date();
    return this.metricsService.getPeriodSavings(
      inverterId,
      user.sub,
      period,
      referenceDate,
    );
  }

  @Get(':inverterId/savings/cumulative')
  @ApiOperation({ summary: 'Get lifetime cumulative savings for an inverter' })
  getCumulativeSavings(
    @Param('inverterId', ParseUUIDPipe) inverterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metricsService.getCumulativeSavings(inverterId, user.sub);
  }
}
