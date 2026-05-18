import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { ChartReadingDto } from './dto/chart-reading.dto';
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
