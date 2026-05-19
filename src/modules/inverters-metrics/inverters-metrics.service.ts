import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { InvertersMetrics } from './entities/inverters-metrics.entity';
import { InverterModelAction } from '../inverters/action/inverters.action';

@Injectable()
export class InvertersMetricsService {
  constructor(
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepository: Repository<InvertersMetrics>,
    private readonly inverterModelAction: InverterModelAction,
  ) {}

  // ENDPOINT 1 — Dashboard Metrics
  async getDashboardMetrics(inverterId: string) {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id: inverterId },
    });

    if (!inverter) {
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }

    const latest = await this.metricsRepository.findOne({
      where: { inverterId },
      order: { metricTimestamp: 'DESC' },
    });

    // Data freshness
    const emptyData = latest === null;
    const dataAgeSeconds = emptyData
      ? null
      : Math.floor((Date.now() - latest.metricTimestamp.getTime()) / 1000);
    const systemOffline =
      emptyData || (dataAgeSeconds !== null && dataAgeSeconds > 900);

    // Health status
    const soc = emptyData ? 0 : Number(latest.batterySocPercent);
    const solarKw = emptyData ? 0 : Number(latest.solarGenKw);
    const panelCapacityKw = Number(inverter.panelCapacityKw);

    let healthStatus: 'RED' | 'AMBER' | 'GREEN';
    let healthReason: string;

    if (systemOffline) {
      healthStatus = 'RED';
      healthReason = emptyData
        ? 'No data received from inverter'
        : 'Inverter has not reported data in over 15 minutes';
    } else if (soc <= 20) {
      healthStatus = 'RED';
      healthReason = 'Battery state of charge is critically low (≤20%)';
    } else if (panelCapacityKw > 0 && solarKw < panelCapacityKw * 0.3) {
      healthStatus = 'AMBER';
      healthReason = 'Solar generation is below 30% of panel capacity';
    } else {
      healthStatus = 'GREEN';
      healthReason = 'System operating normally';
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayMetrics = await this.metricsRepository.find({
      where: { inverterId, createdAt: Between(todayStart, new Date()) },
    });

    const nairaSavedToday = todayMetrics.reduce(
      (sum, m) => sum + Number(m.nairaSavedNgn),
      0,
    );

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthMetrics = await this.metricsRepository.find({
      where: { inverterId, createdAt: Between(monthStart, new Date()) },
    });

    const nairaSavedMonth = monthMetrics.reduce(
      (sum, m) => sum + Number(m.nairaSavedNgn),
      0,
    );

    return {
      solarInputKw: latest?.solarGenKw ?? 0,
      batteryPercent: latest?.batterySocPercent ?? 0,
      runningNowKw: latest?.loadKw ?? 0,
      nairaSavedToday,
      nairaSavedThisMonth: nairaSavedMonth,
      lastUpdated: latest?.metricTimestamp ?? null,
      dataAgeSeconds,
      systemOffline,
      emptyData,
      health: {
        status: healthStatus,
        reason: healthReason,
      },
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

    return rows.map((r) => ({
      date: r.bucket,
      solarKwh: parseFloat(r.solarKwh),
      avgBatterySoc: parseFloat(r.avgBatterySoc),
      avgLoadKw: parseFloat(r.avgLoadKw),
    }));
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
