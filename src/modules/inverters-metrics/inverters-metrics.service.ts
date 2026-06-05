import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { InvertersMetrics } from './entities/inverters-metrics.entity';
import { InverterModelAction } from '../inverters/action/inverters.action';
import { env } from '../../config/env';
import { computeHealthStatus } from './helpers/health-status.helper';
import { UserSettings } from '../users/entities/user-settings.entity';
import { GeneratorFuelType } from '../../common/enums/generator';
import {
  CO2_KG_PER_LITRE,
  estimateFuelConsumptionRate,
  getLatestFuelPrice,
} from './data/fuel';

type Period = 'hourly' | 'daily' | 'weekly' | 'monthly';

// Polling interval in minutes — used to convert kW snapshots to kWh
const POLL_INTERVAL_MINUTES = 5;

@Injectable()
export class InvertersMetricsService {
  constructor(
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepository: Repository<InvertersMetrics>,
    @InjectRepository(UserSettings)
    private readonly userSettingsRepository: Repository<UserSettings>,
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

    // Compute today's savings from load_kw using the user's generator settings,
    // rather than reading the dead nairaSavedNgn column which is never written.
    const settings = await this.userSettingsRepository.findOne({
      where: { user: { id: inverter.userId } },
    });

    const fuelType = settings?.generatorFuelType ?? GeneratorFuelType.PMS;
    const ratedPowerKw = settings?.generatorRatedPowerKw
      ? Number(settings.generatorRatedPowerKw)
      : 2.5;
    const fuelEntry = getLatestFuelPrice(fuelType);
    const fuelPricePerLitreNaira = settings?.customFuelPriceNaira ?? fuelEntry.pricePerLitreNaira;
    const consumptionRateLPerHr = estimateFuelConsumptionRate(
      fuelType,
      ratedPowerKw,
    );

    const todayEnergyRow = await this.metricsRepository
      .createQueryBuilder('m')
      .select(`SUM(m.load_kw) * (5.0 / 60)`, 'energyKwh')
      .where('m.inverter_id = :inverterId', { inverterId })
      .andWhere('m.metric_timestamp >= :todayStart', { todayStart })
      .getRawOne<{ energyKwh: string }>();

    const todayEnergyKwh = parseFloat(todayEnergyRow?.energyKwh ?? '0') || 0;
    const todayFuelSaved =
      ratedPowerKw > 0
        ? (todayEnergyKwh / ratedPowerKw) * consumptionRateLPerHr
        : 0;
    const nairaSavedToday = parseFloat(
      (todayFuelSaved * fuelPricePerLitreNaira).toFixed(2),
    );

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnergyRow = await this.metricsRepository
      .createQueryBuilder('m')
      .select(`SUM(m.load_kw) * (5.0 / 60)`, 'energyKwh')
      .where('m.inverter_id = :inverterId', { inverterId })
      .andWhere('m.metric_timestamp >= :monthStart', { monthStart })
      .getRawOne<{ energyKwh: string }>();

    const monthEnergyKwh = parseFloat(monthEnergyRow?.energyKwh ?? '0') || 0;
    const monthFuelSaved =
      ratedPowerKw > 0
        ? (monthEnergyKwh / ratedPowerKw) * consumptionRateLPerHr
        : 0;
    const nairaSavedThisMonth = parseFloat(
      (monthFuelSaved * fuelPricePerLitreNaira).toFixed(2),
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
      nairaSavedThisMonth,
      health: {
        status: healthStatus,
        reason: healthReason,
      },
      // 7-day daily aggregates for the chart
      sevenDayHistory: sevenDayRows.map((r) => ({
        date: r.date,
        solarKwh: !isNaN(parseFloat(r.solarKwh)) ? parseFloat(r.solarKwh) : 0,
        avgBatterySocPercent: !isNaN(parseFloat(r.avgBatterySoc))
          ? parseFloat(r.avgBatterySoc)
          : 0,
        avgLoadKw: !isNaN(parseFloat(r.avgLoadKw))
          ? parseFloat(r.avgLoadKw)
          : 0,
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

  /**
   * Agent-facing query — no ownership check (the tool handles scoping by userId).
   * mode "current"  → latest single reading for the inverter
   * mode "history"  → aggregated energy usage for the requested period
   */
  async getMetricsForAgent(
    inverterId: string,
    mode: 'current' | 'history',
    period?: 'hourly' | 'daily' | 'weekly' | 'monthly',
  ) {
    if (mode === 'current') {
      const latest = await this.metricsRepository.findOne({
        where: { inverterId },
        order: { metricTimestamp: 'DESC' },
      });

      if (!latest) {
        return { inverterId, mode, data: null };
      }

      return {
        inverterId,
        mode,
        data: {
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
      };
    }

    // mode === 'history'
    const resolvedPeriod = period ?? 'daily';
    const usage = await this.getEnergyUsage(inverterId, resolvedPeriod);
    return { inverterId, mode, ...usage };
  }

  async getPeriodSavings(
    inverterId: string,
    userId: string,
    period: Period,
    date: Date,
  ) {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id: inverterId },
    });
    if (!inverter) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (inverter.userId !== userId)
      throw new ForbiddenException(SYS_MSG.NOT_INVERTER_OWNER);

    const settings = await this.userSettingsRepository.findOne({
      where: { user: { id: inverter.userId } },
    });

    const fuelType = settings?.generatorFuelType ?? GeneratorFuelType.PMS;
    const ratedPowerKw = settings?.generatorRatedPowerKw
      ? Number(settings.generatorRatedPowerKw)
      : 2.5; // sensible default for a small SME generator

    const fuelEntry = getLatestFuelPrice(fuelType);
    const fuelPricePerLitreNaira = settings?.customFuelPriceNaira ?? fuelEntry.pricePerLitreNaira;
    const consumptionRateLPerHr = estimateFuelConsumptionRate(
      fuelType,
      ratedPowerKw,
    );
    const co2Factor = CO2_KG_PER_LITRE[fuelType];
    const tz = 'Africa/Lagos';

    // Compute date range
    const { rangeStart, rangeEnd, chartGroupExpr, chartOrderExpr } =
      this.getPeriodRange(period, date, tz);

    // Per-day breakdown (or per-hour for daily period)
    const breakdownRows = await this.metricsRepository
      .createQueryBuilder('m')
      .select(chartGroupExpr, 'bucket')
      .addSelect(
        `SUM(m.load_kw) * (${POLL_INTERVAL_MINUTES}.0 / 60)`,
        'energyKwh',
      )
      .addSelect(
        `SUM(m.solar_gen_kw) * (${POLL_INTERVAL_MINUTES}.0 / 60)`,
        'solarKwh'
      )
      .addSelect(
        `COUNT(DISTINCT DATE_TRUNC('hour', m.metric_timestamp AT TIME ZONE '${tz}'))`,
        'activeHours',
      )
      .where('m.inverter_id = :inverterId', { inverterId })
      .andWhere('m.metric_timestamp >= :rangeStart', { rangeStart })
      .andWhere('m.metric_timestamp < :rangeEnd', { rangeEnd })
      .groupBy(chartGroupExpr)
      .orderBy(chartOrderExpr, 'ASC')
      .getRawMany<{ bucket: string; energyKwh: string; solarKwh: string; activeHours: string }>();

    // Totals for the entire period
    const totalEnergyConsumedKwh = breakdownRows.reduce(
      (sum, r) => sum + parseFloat(r.energyKwh),
      0,
    );

    const totalSolarGeneratedKwh = breakdownRows.reduce(
      (sum, r) => sum + parseFloat(r.solarKwh),
      0,
    )

    const solarCoveragePercent =
      totalEnergyConsumedKwh > 0
        ? parseFloat(
            Math.min(
              (totalSolarGeneratedKwh / totalEnergyConsumedKwh) * 100,
              100,
            ).toFixed(1),
          )
        : null;



    const totalActiveHours = breakdownRows.reduce(
      (sum, r) => sum + parseInt(r.activeHours, 10),
      0,
    );

    // Fuel and cost calculations
    // kWh ÷ (L/hr ÷ 1 hr) → but the generator produces ratedPowerKw kW per hour,
    // consuming consumptionRateLPerHr litres. So:
    //   litres_needed = energyKwh / ratedPowerKw × consumptionRateLPerHr
    const fuelSavedLitres =
      ratedPowerKw > 0
        ? (totalEnergyConsumedKwh / ratedPowerKw) * consumptionRateLPerHr
        : 0;

    const generatorCostAvoidedNgn =
      fuelSavedLitres * fuelPricePerLitreNaira;
    const co2AvoidedKg = fuelSavedLitres * co2Factor;

    // Days with any data in the period (used for daily average)
    const daysWithData =
      breakdownRows.filter((r) => parseFloat(r.energyKwh) > 0).length || 1;

    const breakdown = breakdownRows.map((r) => {
      const dayEnergyKwh = parseFloat(r.energyKwh);
      const dayFuelSaved =
        ratedPowerKw > 0
          ? (dayEnergyKwh / ratedPowerKw) * consumptionRateLPerHr
          : 0;
      return {
        bucket: r.bucket,
        activeHours: parseInt(r.activeHours, 10),
        energyKwh: parseFloat(dayEnergyKwh.toFixed(3)),
        solarKwh: parseFloat(parseFloat(r.solarKwh).toFixed(3)),
        generatorCostSavedNgn: parseFloat(
          (dayFuelSaved * fuelPricePerLitreNaira).toFixed(2),
        ),
        fuelSavedLitres: parseFloat(dayFuelSaved.toFixed(3)),
      };
    });

    return {
      period,
      date: date instanceof Date ? date.toISOString().split('T')[0] : date,

      // Results
      results: {
        totalCostSavedNgn: parseFloat(generatorCostAvoidedNgn.toFixed(2)),
        generatorCostAvoidedNgn: parseFloat(generatorCostAvoidedNgn.toFixed(2)),
        fuelSavedLitres: parseFloat(fuelSavedLitres.toFixed(3)),
        co2AvoidedKg: parseFloat(co2AvoidedKg.toFixed(3)),
        breakdown,
      },

      // Summary
      summary: {
        totalCostSavedNgn: parseFloat(generatorCostAvoidedNgn.toFixed(2)),
        averageCostSavedNgn: parseFloat(
          (generatorCostAvoidedNgn / daysWithData).toFixed(2),
        ),
        totalEnergyConsumedKwh: parseFloat(totalEnergyConsumedKwh.toFixed(3)),
        totalEnergyGeneratedKwh: parseFloat(totalSolarGeneratedKwh.toFixed(3)),
        solarCoveragePercent,
        totalActiveHours,
      },

      // Chart — one point per bucket (hour/day/week/month depending on period)
      chart: breakdown.map((b) => ({
        label: b.bucket,
        savingsNgn: b.generatorCostSavedNgn,
      })),

      // Meta — so the frontend can show "based on X fuel at ₦Y/L"
      meta: {
        fuelType,
        fuelPricePerLitreNgn: fuelPricePerLitreNaira,
        fuelPriceLastUpdated: new Date(fuelEntry.updatedAt).toISOString(),
        assumedGeneratorRatedPowerKw: ratedPowerKw,
        assumedConsumptionRateLPerHr: consumptionRateLPerHr,
      },
    };
  }

  async getCumulativeSavings(inverterId: string, userId: string) {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id: inverterId },
    });
    if (!inverter) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (inverter.userId !== userId)
      throw new ForbiddenException(SYS_MSG.NOT_INVERTER_OWNER);

    const settings = await this.userSettingsRepository.findOne({
      where: { user: { id: inverter.userId } },
    });

    const fuelType = settings?.generatorFuelType ?? GeneratorFuelType.PMS;
    const ratedPowerKw = settings?.generatorRatedPowerKw
      ? Number(settings.generatorRatedPowerKw)
      : 2.5;

    const fuelEntry = getLatestFuelPrice(fuelType);
    const fuelPricePerLitreNaira = settings?.customFuelPriceNaira ?? fuelEntry.pricePerLitreNaira;
    const consumptionRateLPerHr = estimateFuelConsumptionRate(
      fuelType,
      ratedPowerKw,
    );
    const co2Factor = CO2_KG_PER_LITRE[fuelType];
    const tz = 'Africa/Lagos';

    // Monthly buckets since the inverter record was created
    const monthlyRows = await this.metricsRepository
      .createQueryBuilder('m')
      .select(
        `TO_CHAR(DATE_TRUNC('month', m.metric_timestamp AT TIME ZONE '${tz}'), 'YYYY-MM')`,
        'month',
      )
      .addSelect(
        `SUM(m.load_kw) * (${POLL_INTERVAL_MINUTES}.0 / 60)`,
        'energyKwh',
      )
      .addSelect(
        `SUM(m.solar_gen_kw) * (${POLL_INTERVAL_MINUTES}.0 / 60)`,
        'solarKwh'
      )
      .where('m.inverter_id = :inverterId', { inverterId })
      .groupBy(`DATE_TRUNC('month', m.metric_timestamp AT TIME ZONE '${tz}')`)
      .orderBy(
        `DATE_TRUNC('month', m.metric_timestamp AT TIME ZONE '${tz}')`,
        'ASC',
      )
      .getRawMany<{ month: string; energyKwh: string; solarKwh: string }>();

    const monthlyData = monthlyRows.map((r) => {
      const energyKwh = parseFloat(r.energyKwh);
      const solarKwh = parseFloat(r.solarKwh);
      const fuelSaved =
        ratedPowerKw > 0
          ? (energyKwh / ratedPowerKw) * consumptionRateLPerHr
          : 0;
      return {
        month: r.month, // already 'YYYY-MM' from TO_CHAR
        energyKwh: parseFloat(energyKwh.toFixed(3)),
        solarKwh: parseFloat(solarKwh.toFixed(3)),
        fuelSavedLitres: parseFloat(fuelSaved.toFixed(3)),
        savingsNgn: parseFloat(
          (fuelSaved * fuelPricePerLitreNaira).toFixed(2),
        ),
      };
    });

    // ── Lifetime totals ───────────────────────────────────────────────────────
    const lifetimeEnergyKwh = monthlyData.reduce((s, r) => s + r.energyKwh, 0);
    const lifetimeSolarKwh = monthlyData.reduce((s, r) => s + r.solarKwh, 0);
    const lifetimeFuelSavedLitres = monthlyData.reduce(
      (s, r) => s + r.fuelSavedLitres,
      0,
    );
    const lifetimeSavingsNgn = monthlyData.reduce(
      (s, r) => s + r.savingsNgn,
      0,
    );
    const lifetimeCo2AvoidedKg = lifetimeFuelSavedLitres * co2Factor;

    // Generator hours avoided = energy delivered ÷ rated output power
    const generatorHoursAvoided =
      ratedPowerKw > 0
        ? parseFloat((lifetimeEnergyKwh / ratedPowerKw).toFixed(1))
        : 0;

    const monthsActive = monthlyData.length || 1;
    const averageMonthlySavingsNgn = parseFloat(
      (lifetimeSavingsNgn / monthsActive).toFixed(2),
    );

    return {
      // Cumulative totals
      lifetimeSavingsNgn: parseFloat(lifetimeSavingsNgn.toFixed(2)),
      lifetimeEnergyConsumedKwh: parseFloat(lifetimeEnergyKwh.toFixed(3)),
      lifetimeEnergyGeneratedKwh: parseFloat(lifetimeSolarKwh.toFixed(3)),
      lifetimeFuelSavedLitres: parseFloat(lifetimeFuelSavedLitres.toFixed(3)),
      co2AvoidedKg: parseFloat(lifetimeCo2AvoidedKg.toFixed(3)),
      generatorHoursAvoided,
      totalSavingsToDateNgn: parseFloat(lifetimeSavingsNgn.toFixed(2)),
      averageMonthlySavingsNgn,

      // Chart — one point per month since inverter connected
      chart: monthlyData.map((m) => ({
        month: m.month,
        savingsNgn: m.savingsNgn,
      })),

      // Meta
      meta: {
        fuelType,
        fuelPricePerLitreNgn: fuelPricePerLitreNaira,
        fuelPriceLastUpdated: new Date(fuelEntry.updatedAt).toISOString(),
        assumedGeneratorRatedPowerKw: ratedPowerKw,
        assumedConsumptionRateLPerHr: consumptionRateLPerHr,
      },
    };
  }

  async getCustomRangeSavings(
    inverterId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id: inverterId },
    });
    if (!inverter) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    if (inverter.userId !== userId)
      throw new ForbiddenException(SYS_MSG.NOT_INVERTER_OWNER);

    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const settings = await this.userSettingsRepository.findOne({
      where: { user: { id: inverter.userId } },
    });

    const fuelType = settings?.generatorFuelType ?? GeneratorFuelType.PMS;
    const ratedPowerKw = settings?.generatorRatedPowerKw
      ? Number(settings.generatorRatedPowerKw)
      : 2.5;

    const fuelEntry = getLatestFuelPrice(fuelType);
    const fuelPricePerLitreNaira = settings?.customFuelPriceNaira ?? fuelEntry.pricePerLitreNaira;
    const consumptionRateLPerHr = estimateFuelConsumptionRate(
      fuelType,
      ratedPowerKw,
    );
    const co2Factor = CO2_KG_PER_LITRE[fuelType];
    const tz = 'Africa/Lagos';

    // Auto-select chart granularity based on span length
    const spanDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let chartGroupExpr: string;
    let granularity: 'hour' | 'day' | 'week' | 'month';

    if (spanDays <= 2) {
      // Up to 2 days: group by hour
      chartGroupExpr = `DATE_TRUNC('hour', m.metric_timestamp AT TIME ZONE '${tz}')`;
      granularity = 'hour';
    } else if (spanDays < 21) {
      // 3–20 days (less than 3 weeks): group by day
      chartGroupExpr = `DATE(m.metric_timestamp AT TIME ZONE '${tz}')`;
      granularity = 'day';
    } else if (spanDays <= 90) {
      // 3 weeks–3 months: group by week
      chartGroupExpr = `DATE_TRUNC('week', m.metric_timestamp AT TIME ZONE '${tz}')`;
      granularity = 'week';
    } else {
      // More than 3 months: group by month
      chartGroupExpr = `DATE_TRUNC('month', m.metric_timestamp AT TIME ZONE '${tz}')`;
      granularity = 'month';
    }

    const breakdownRows = await this.metricsRepository
      .createQueryBuilder('m')
      .select(chartGroupExpr, 'bucket')
      .addSelect(
        `SUM(m.load_kw) * (${POLL_INTERVAL_MINUTES}.0 / 60)`,
        'energyKwh',
      )
      .addSelect(
        `SUM(m.solar_gen_kw) * (${POLL_INTERVAL_MINUTES}.0 / 60)`,
        'solarKwh'
      )
      .addSelect(
        `COUNT(DISTINCT DATE_TRUNC('hour', m.metric_timestamp AT TIME ZONE '${tz}'))`,
        'activeHours',
      )
      .where('m.inverter_id = :inverterId', { inverterId })
      .andWhere('m.metric_timestamp >= :startDate', { startDate })
      .andWhere('m.metric_timestamp < :endDate', { endDate })
      .groupBy(chartGroupExpr)
      .orderBy(chartGroupExpr, 'ASC')
      .getRawMany<{ bucket: string; energyKwh: string; activeHours: string; solarKwh: string }>();

    const totalEnergyKwh = breakdownRows.reduce(
      (sum, r) => sum + parseFloat(r.energyKwh),
      0,
    );
    const totalSolarKwh = breakdownRows.reduce((s, r) => s + parseFloat(r.solarKwh), 0);
    const totalActiveHours = breakdownRows.reduce(
      (sum, r) => sum + parseInt(r.activeHours, 10),
      0,
    );

    const fuelSavedLitres =
      ratedPowerKw > 0
        ? (totalEnergyKwh / ratedPowerKw) * consumptionRateLPerHr
        : 0;
    const generatorCostAvoidedNgn =
      fuelSavedLitres * fuelPricePerLitreNaira;
    const co2AvoidedKg = fuelSavedLitres * co2Factor;

    const bucketsWithData =
      breakdownRows.filter((r) => parseFloat(r.energyKwh) > 0).length || 1;

    const breakdown = breakdownRows.map((r) => {
      const bucketEnergyKwh = parseFloat(r.energyKwh);
      const bucketSolarKwh = parseFloat(r.solarKwh);
      const bucketFuelSaved =
        ratedPowerKw > 0
          ? (bucketEnergyKwh / ratedPowerKw) * consumptionRateLPerHr
          : 0;
      return {
        bucket: r.bucket,
        activeHours: parseInt(r.activeHours, 10),
        energyKwh: parseFloat(bucketEnergyKwh.toFixed(3)),
        solarKwh: parseFloat(bucketSolarKwh.toFixed(3)),
        generatorCostSavedNgn: parseFloat(
          (bucketFuelSaved * fuelPricePerLitreNaira).toFixed(2),
        ),
        fuelSavedLitres: parseFloat(bucketFuelSaved.toFixed(3)),
      };
    });

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      spanDays,
      granularity,

      results: {
        totalCostSavedNgn: parseFloat(generatorCostAvoidedNgn.toFixed(2)),
        generatorCostAvoidedNgn: parseFloat(generatorCostAvoidedNgn.toFixed(2)),
        fuelSavedLitres: parseFloat(fuelSavedLitres.toFixed(3)),
        co2AvoidedKg: parseFloat(co2AvoidedKg.toFixed(3)),
        breakdown,
      },

      summary: {
        totalCostSavedNgn: parseFloat(generatorCostAvoidedNgn.toFixed(2)),
        averageCostSavedPerBucketNgn: parseFloat(
          (generatorCostAvoidedNgn / bucketsWithData).toFixed(2),
        ),
        totalEnergyConsumedKwh: parseFloat(totalEnergyKwh.toFixed(3)),
        totalEnergyGeneratedKwh: parseFloat(totalSolarKwh.toFixed(3)),
        totalActiveHours,
      },

      chart: breakdown.map((b) => ({
        label: b.bucket,
        savingsNgn: b.generatorCostSavedNgn,
      })),

      meta: {
        fuelType,
        fuelPricePerLitreNgn: fuelPricePerLitreNaira,
        fuelPriceLastUpdated: new Date(fuelEntry.updatedAt).toISOString(),
        assumedGeneratorRatedPowerKw: ratedPowerKw,
        assumedConsumptionRateLPerHr: consumptionRateLPerHr,
      },
    };
  }

  private getPeriodRange(
    period: Period,
    date: Date,
    tz: string,
  ): {
    rangeStart: Date;
    rangeEnd: Date;
    chartGroupExpr: string;
    chartOrderExpr: string;
  } {
    // Work in Lagos local time for day/week/month boundaries
    const d = date instanceof Date ? date : new Date(date);

    let rangeStart: Date;
    let rangeEnd: Date;
    let chartGroupExpr: string;
    let chartOrderExpr: string;

    switch (period) {
      case 'daily': {
        // One specific day — group by hour
        rangeStart = new Date(d);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(d);
        rangeEnd.setDate(d.getDate() + 1);
        rangeEnd.setHours(0, 0, 0, 0);
        chartGroupExpr = `DATE_TRUNC('hour', m.metric_timestamp AT TIME ZONE '${tz}')`;
        chartOrderExpr = chartGroupExpr;
        break;
      }
      case 'weekly': {
        // ISO week containing `date` — group by day
        const dayOfWeek = d.getDay(); // 0 = Sunday
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        rangeStart = new Date(d);
        rangeStart.setDate(d.getDate() + mondayOffset);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeStart.getDate() + 7);
        chartGroupExpr = `DATE(m.metric_timestamp AT TIME ZONE '${tz}')`;
        chartOrderExpr = chartGroupExpr;
        break;
      }
      case 'monthly': {
        // Calendar month containing `date` — group by day
        rangeStart = new Date(d.getFullYear(), d.getMonth(), 1);
        rangeEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        chartGroupExpr = `DATE(m.metric_timestamp AT TIME ZONE '${tz}')`;
        chartOrderExpr = chartGroupExpr;
        break;
      }
      case 'hourly':
      default: {
        // Last 24 hours from `date` — group by hour
        rangeEnd = new Date(d);
        rangeStart = new Date(d.getTime() - 24 * 60 * 60 * 1000);
        chartGroupExpr = `DATE_TRUNC('hour', m.metric_timestamp AT TIME ZONE '${tz}')`;
        chartOrderExpr = chartGroupExpr;
        break;
      }
    }

    return { rangeStart, rangeEnd, chartGroupExpr, chartOrderExpr };
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

  parseDateOrThrow(value: string, field: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return d;
  }
}
