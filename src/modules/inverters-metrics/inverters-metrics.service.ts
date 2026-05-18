import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { InvertersMetrics } from './entities/inverters-metrics.entity';

@Injectable()
export class InvertersMetricsService {
  constructor(
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepository: Repository<InvertersMetrics>,
  ) {}

  // ENDPOINT 1 — Dashboard Metrics
  async getDashboardMetrics(inverterId: string) {
    const latest = await this.metricsRepository.findOne({
      where: { inverterId },
      order: { metricTimestamp: 'DESC' },
    });

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
