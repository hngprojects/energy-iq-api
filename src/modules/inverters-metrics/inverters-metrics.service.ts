import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { ChartReadingDto } from './dto/chart-reading.dto';
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

  // ENDPOINT 3 — Energy Usage Chart
  async getEnergyUsage(
    inverterId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
  ) {
    if (!['hourly', 'daily', 'weekly', 'monthly'].includes(period)) {
      throw new BadRequestException(SYS_MSG.BAD_REQUEST);
    }

    const now = new Date();
    const startDate = this.getStartDate(period, now);

    const metrics = await this.metricsRepository.find({
      where: { inverterId, createdAt: Between(startDate, now) },
      order: { createdAt: 'ASC' },
    });

    const grouped = new Map<string, ChartReadingDto>();

    for (const metric of metrics) {
      const day = metric.metricTimestamp.toLocaleDateString('en-US', {
        weekday: 'long',
      });

      const current = grouped.get(day) ?? {
        energy_generated: 0,
        energy_usage: 0,
      };

      grouped.set(day, {
        energy_generated: current.energy_generated + Number(metric.solarGenKw),
        energy_usage: current.energy_usage + Number(metric.loadKw),
      });
    }

    return Array.from(grouped.entries()).map(([day, values]) => ({
      timestamp: day,
      energy_generated: values.energy_generated,
      energy_usage: values.energy_usage,
    }));
  }

  private getStartDate(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    now: Date,
  ): Date {
    const start = new Date(now);
    switch (period) {
      case 'hourly':
        start.setHours(start.getHours() - 1);
        break;
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
    }
    return start;
  }
}
