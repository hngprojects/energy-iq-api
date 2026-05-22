import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { InvertersMetrics } from './entities/inverters-metrics.entity';
import { InverterModelAction } from '../inverters/action/inverters.action';
import { env } from '../../config/env';
import { computeHealthStatus } from './helpers/health-status.helper';

@Injectable()
export class InvertersMetricsService {
  constructor(
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepository: Repository<InvertersMetrics>,
    private readonly inverterModelAction: InverterModelAction,
  ) {}

  // ENDPOINT 1 — Dashboard Metrics
  async getDashboardMetrics(inverterId: string, requestingUserId: string) {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id: inverterId },
    });

    if (!inverter) {
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }

    // Ownership check — only the inverter owner can view its dashboard
    if (inverter.userId !== requestingUserId) {
      throw new ForbiddenException(SYS_MSG.FORBIDDEN);
    }

    const tz = 'Africa/Lagos';

    // Run the latest-reading query and the 7-day daily aggregate in parallel
    const [latest, sevenDayRows] = await Promise.all([
      this.metricsRepository.findOne({
        where: { inverterId },
        order: { metricTimestamp: 'DESC' },
      }),
      this.metricsRepository
        .createQueryBuilder('m')
        .select(`DATE(m.metric_timestamp AT TIME ZONE '${tz}')`, 'date')
        .addSelect(`SUM(m.solar_gen_kw) * (5.0 / 60)`, 'solarKwh')
        .addSelect('AVG(m.battery_soc_percent)', 'avgBatterySoc')
        .addSelect('AVG(m.load_kw)', 'avgLoadKw')
        .where('m.inverter_id = :inverterId', { inverterId })
        .andWhere(`m.metric_timestamp >= NOW() - INTERVAL '7 days'`)
        .groupBy(`DATE(m.metric_timestamp AT TIME ZONE '${tz}')`)
        .orderBy(`DATE(m.metric_timestamp AT TIME ZONE '${tz}')`, 'ASC')
        .getRawMany<{
          date: string;
          solarKwh: string;
          avgBatterySoc: string;
          avgLoadKw: string;
        }>(),
    ]);

    // Data freshness
    const emptyData = latest === null;
    const dataAgeSeconds = emptyData
      ? null
      : Math.floor((Date.now() - latest.metricTimestamp.getTime()) / 1000);
    const systemOffline = inverter.isOffline;
    // The metrics poller already marks inverter as offline when it doesn't get data from
    // it for that long

    // Health status
    const socPercent = emptyData ? null : Number(latest.batterySocPercent);
    const solarKw = emptyData ? 0 : Number(latest.solarGenKw);
    const panelCapacityKw = Number(inverter.panelCapacityKw);

    const { status: healthStatus, reason: healthReason } = computeHealthStatus({
      socPercent,
      solarKw,
      panelCapacityKw,
      systemOffline,
      criticalSocThreshold: env.METRIC_CRITICAL_BATTERY_THRESHOLD,
      lowSocThreshold: env.METRIC_LOW_BATTERY_THRESHOLD,
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [todayMetrics, monthMetrics] = await Promise.all([
      this.metricsRepository.find({
        where: { inverterId, createdAt: Between(todayStart, new Date()) },
        select: ['nairaSavedNgn'],
      }),
      this.metricsRepository.find({
        where: { inverterId, createdAt: Between(monthStart, new Date()) },
        select: ['nairaSavedNgn'],
      }),
    ]);

    const nairaSavedToday = todayMetrics.reduce(
      (sum, m) => sum + Number(m.nairaSavedNgn),
      0,
    );
    const nairaSavedMonth = monthMetrics.reduce(
      (sum, m) => sum + Number(m.nairaSavedNgn),
      0,
    );

    return {
      // Current snapshot - initial page-load values; live updates come via SSE
      currentReadings: emptyData
        ? null
        : {
            solarKw: Number(latest.solarGenKw),
            batterySocPercent: Number(latest.batterySocPercent),
            loadKw: Number(latest.loadKw),
            gridVoltageV:
              latest.gridVoltageV != null ? Number(latest.gridVoltageV) : null,
            batteryVoltageV:
              latest.batteryVoltageV != null
                ? Number(latest.batteryVoltageV)
                : null,
            recordedAt: latest.metricTimestamp,
          },
      dataAgeSeconds,
      systemOffline,
      emptyData,
      nairaSavedToday,
      nairaSavedThisMonth: nairaSavedMonth,
      health: {
        status: healthStatus,
        reason: healthReason,
      },
      // 7-day daily aggregates for the chart
      sevenDayHistory: sevenDayRows.map((r) => ({
        date: r.date,
        solarKwh: !isNaN(parseFloat(r.solarKwh)) ? parseFloat(r.solarKwh) : 0,
        avgBatterySocPercent: !isNaN(parseFloat(r.avgBatterySoc)) ? parseFloat(r.avgBatterySoc) : 0,
        avgLoadKw: !isNaN(parseFloat(r.avgLoadKw)) ? parseFloat(r.avgLoadKw) : 0,
      })),
    };
  }

  // ENDPOINT 2 — Power Consumption (placeholder)
  getPowerConsumption(_inverterId: string): void {}

  async getEnergyUsage(
    inverterId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
  ) {
    if (!['hourly', 'daily', 'weekly', 'monthly'].includes(period)) {
      throw new BadRequestException(SYS_MSG.BAD_REQUEST);
    }

    const tz = 'Africa/Lagos';
    const { interval, groupExpr, orderExpr } = this.getPeriodConfig(period, tz);

    const rows = await this.metricsRepository
      .createQueryBuilder('m')
      .select(groupExpr, 'bucket')
      .addSelect('SUM(m.solar_gen_kw) * (5.0 / 60)', 'solarKwh')
      .addSelect('AVG(m.battery_soc_percent)', 'avgBatterySoc')
      .addSelect('AVG(m.load_kw)', 'avgLoadKw')
      .where('m.inverter_id = :inverterId', { inverterId })
      .andWhere(`m.metric_timestamp >= NOW() - INTERVAL '${interval}'`)
      .groupBy(groupExpr)
      .orderBy(orderExpr, 'ASC')
      .getRawMany<{
        bucket: string;
        solarKwh: string;
        avgBatterySoc: string;
        avgLoadKw: string;
      }>();

    return {
      period,
      data: rows.map((r) => ({
        date: r.bucket,
        solarKwh: parseFloat(r.solarKwh),
        avgBatterySoc: parseFloat(r.avgBatterySoc),
        avgLoadKw: parseFloat(r.avgLoadKw),
      })),
    };
  }

  private getPeriodConfig(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    tz: string,
  ): { interval: string; groupExpr: string; orderExpr: string } {
    switch (period) {
      case 'hourly':
        return {
          interval: '24 hours',
          groupExpr: `DATE_TRUNC('hour', m.metric_timestamp AT TIME ZONE '${tz}')`,
          orderExpr: `DATE_TRUNC('hour', m.metric_timestamp AT TIME ZONE '${tz}')`,
        };
      case 'daily':
        return {
          interval: '7 days',
          groupExpr: `DATE(m.metric_timestamp AT TIME ZONE '${tz}')`,
          orderExpr: `DATE(m.metric_timestamp AT TIME ZONE '${tz}')`,
        };
      case 'weekly':
        return {
          interval: '12 weeks',
          groupExpr: `DATE_TRUNC('week', m.metric_timestamp AT TIME ZONE '${tz}')`,
          orderExpr: `DATE_TRUNC('week', m.metric_timestamp AT TIME ZONE '${tz}')`,
        };
      case 'monthly':
        return {
          interval: '12 months',
          groupExpr: `DATE_TRUNC('month', m.metric_timestamp AT TIME ZONE '${tz}')`,
          orderExpr: `DATE_TRUNC('month', m.metric_timestamp AT TIME ZONE '${tz}')`,
        };
    }
  }
}
