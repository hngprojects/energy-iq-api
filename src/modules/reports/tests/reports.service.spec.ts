// Mock the config chain before any imports to prevent @t3-oss/env-core ESM parse error
jest.mock('../../../config/env', () => ({}));
jest.mock('../../../config/app.config', () => ({ appConfig: { KEY: 'app' } }));
jest.mock('puppeteer', () => ({}));

import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../reports.service';
import { InvertersService } from '../../inverters/inverters.service';
import { UsersService } from '../../users/users.service';
import { InvertersMetricsService } from '../../inverters-metrics/inverters-metrics.service';
import { AlertsService } from '../../alerts/alerts.service';
import { ReportModelAction } from '../action/report.action';
import {
  ReportPeriod,
  ReportStatus,
  ReportType,
} from '../../../common/enums/reports.type';
import { AlertSeverity, AlertType } from '../../../common/enums';
import { GeneratorFuelType } from '../../../common/enums/generator';
import { Report } from '../entities/report.entity';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../../../common/constants/queue';
import { appConfig } from '../../../config/app.config';

const mockInvertersService = {};
const mockUsersService = {};
const mockInvertersMetricsService = {
  getPeriodSolarReport: jest.fn(),
  getCustomRangeSolarReport: jest.fn(),
  getPeriodCostsAndSavingsReport: jest.fn(),
  getCustomRangeCostsAndSavingsReport: jest.fn(),
};
const mockReportModelAction = {
  findById: jest.fn(),
  updateReport: jest.fn(),
};
const mockAlertsService = {
  getAlertReport: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

describe('ReportsService', () => {
  let service: ReportsService;

  const periodReport = {
    id: 'report-1',
    name: 'June report',
    period: ReportPeriod.MONTHLY,
  } as Report;

  const customRangeReport = {
    id: 'report-1',
    name: 'June report',
    period: ReportPeriod.CUSTOM,
  } as Report;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: InvertersService, useValue: mockInvertersService },
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: InvertersMetricsService,
          useValue: mockInvertersMetricsService,
        },
        { provide: ReportModelAction, useValue: mockReportModelAction },
        { provide: AlertsService, useValue: mockAlertsService },
        { provide: getQueueToken(QUEUES.REPORT_DISPATCH), useValue: mockQueue },
        {
          provide: appConfig.KEY,
          useValue: { clientUrl: 'https://example.com' },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('gets a report by id', async () => {
    mockReportModelAction.findById.mockResolvedValue(periodReport);

    const result = await service.getReportById('report-1');

    expect(mockReportModelAction.findById).toHaveBeenCalledWith('report-1');
    expect(result).toBe(periodReport);
  });

  it('computes a period solar report', async () => {
    const solarReport = {
      name: periodReport.name,
      period: periodReport.period,
      status: ReportStatus.READY,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
      type: ReportType.SOLAR,
      keyMetrics: {
        solarKwh: 120,
        avgBatterySoc: 75,
        avgLoadKw: 8,
        totalActiveHours: 18,
      },
    };

    mockInvertersMetricsService.getPeriodSolarReport.mockResolvedValue(
      solarReport,
    );

    const result = await service.computeSolarReport(periodReport);

    expect(
      mockInvertersMetricsService.getPeriodSolarReport,
    ).toHaveBeenCalledWith(periodReport);
    expect(result).toBe(solarReport);
  });

  it('computes a custom range solar report', async () => {
    const solarReport = {
      name: customRangeReport.name,
      period: customRangeReport.period,
      status: ReportStatus.READY,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
      type: ReportType.SOLAR,
      keyMetrics: {
        solarKwh: 120,
        avgBatterySoc: 75,
        avgLoadKw: 8,
        totalActiveHours: 18,
      },
    };

    mockInvertersMetricsService.getCustomRangeSolarReport.mockResolvedValue(
      solarReport,
    );

    const result = await service.computeSolarReport(customRangeReport);

    expect(
      mockInvertersMetricsService.getCustomRangeSolarReport,
    ).toHaveBeenCalledWith(customRangeReport);
    expect(result).toBe(solarReport);
  });

  it('computes a period alert report', async () => {
    const alertReport = {
      name: periodReport.name,
      period: periodReport.period,
      status: ReportStatus.READY,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
      type: ReportType.ALERT,
      keyMetrics: {
        totalAlerts: 10,
        resolvedAlerts: 7,
        unresolvedAlerts: 3,
        dominantAlertType: AlertType.ENERGY,
        dominantAlertSeverity: AlertSeverity.HIGH,
        resolutionRate: 70,
      },
    };

    mockAlertsService.getAlertReport.mockResolvedValue(alertReport);

    const result = await service.computeAlertReport(periodReport);

    expect(mockAlertsService.getAlertReport).toHaveBeenCalledWith(periodReport);
    expect(result).toBe(alertReport);
  });

  it('computes a custom range alert report', async () => {
    const alertReport = {
      name: customRangeReport.name,
      period: customRangeReport.period,
      status: ReportStatus.READY,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
      type: ReportType.ALERT,
      keyMetrics: {
        totalAlerts: 10,
        resolvedAlerts: 7,
        unresolvedAlerts: 3,
        dominantAlertType: AlertType.ENERGY,
        dominantAlertSeverity: AlertSeverity.HIGH,
        resolutionRate: 70,
      },
    };

    mockAlertsService.getAlertReport.mockResolvedValue(alertReport);

    const result = await service.computeAlertReport(customRangeReport);

    expect(mockAlertsService.getAlertReport).toHaveBeenCalledWith(
      customRangeReport,
    );
    expect(result).toBe(alertReport);
  });

  it('computes a period cost and savings report', async () => {
    const costSavingsReport = {
      name: periodReport.name,
      period: periodReport.period,
      status: ReportStatus.READY,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
      type: ReportType.CSC,
      keyMetrics: {
        totalCostSavedNgn: 50000,
        generatorCostAvoidedNgn: 30000,
        fuelSavedLitres: 20,
        co2AvoidedKg: 15,
        totalActiveHours: 12,
        totalEnergyGeneratedKwh: 90,
        totalEnergyConsumedKwh: 80,
        meta: {
          fuelType: GeneratorFuelType.DIESEL,
          fuelPricePerLitreNgn: 1500,
          assumedGeneratorRatedPowerKw: 12,
          assumedConsumptionRateLPerHr: 2,
        },
      },
    };

    mockInvertersMetricsService.getPeriodCostsAndSavingsReport.mockResolvedValue(
      costSavingsReport,
    );

    const result = await service.computeCostAndSavingsReport(periodReport);

    expect(
      mockInvertersMetricsService.getPeriodCostsAndSavingsReport,
    ).toHaveBeenCalledWith(periodReport);
    expect(result).toBe(costSavingsReport);
  });

  it('computes a custom range cost and savings report', async () => {
    const costSavingsReport = {
      name: customRangeReport.name,
      period: customRangeReport.period,
      status: ReportStatus.READY,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
      type: ReportType.CSC,
      keyMetrics: {
        totalCostSavedNgn: 50000,
        generatorCostAvoidedNgn: 30000,
        fuelSavedLitres: 20,
        co2AvoidedKg: 15,
        totalActiveHours: 12,
        totalEnergyGeneratedKwh: 90,
        totalEnergyConsumedKwh: 80,
        meta: {
          fuelType: GeneratorFuelType.DIESEL,
          fuelPricePerLitreNgn: 1500,
          assumedGeneratorRatedPowerKw: 12,
          assumedConsumptionRateLPerHr: 2,
        },
      },
    };

    mockInvertersMetricsService.getCustomRangeCostsAndSavingsReport.mockResolvedValue(
      costSavingsReport,
    );

    const result = await service.computeCostAndSavingsReport(customRangeReport);

    expect(
      mockInvertersMetricsService.getCustomRangeCostsAndSavingsReport,
    ).toHaveBeenCalledWith(customRangeReport);
    expect(result).toBe(costSavingsReport);
  });

  it('computes a general report by merging key metrics from subreports', async () => {
    const deliveredBefore = new Date();

    mockAlertsService.getAlertReport.mockResolvedValue({
      keyMetrics: {
        totalAlerts: 10,
        resolvedAlerts: 7,
        unresolvedAlerts: 3,
        dominantAlertType: AlertType.ENERGY,
        dominantAlertSeverity: AlertSeverity.HIGH,
        resolutionRate: 70,
      },
    });
    mockInvertersMetricsService.getPeriodCostsAndSavingsReport.mockResolvedValue(
      {
        keyMetrics: {
          totalCostSavedNgn: 50000,
          generatorCostAvoidedNgn: 30000,
          fuelSavedLitres: 20,
          co2AvoidedKg: 15,
          totalActiveHours: 12,
          totalEnergyGeneratedKwh: 90,
          totalEnergyConsumedKwh: 80,
          meta: {
            fuelType: GeneratorFuelType.DIESEL,
            fuelPricePerLitreNgn: 1500,
            assumedGeneratorRatedPowerKw: 12,
            assumedConsumptionRateLPerHr: 2,
          },
        },
      },
    );
    mockInvertersMetricsService.getPeriodSolarReport.mockResolvedValue({
      keyMetrics: {
        solarKwh: 120,
        avgBatterySoc: 75,
        avgLoadKw: 8,
        totalActiveHours: 18,
      },
    });

    const result = await service.computeGeneralReport(periodReport);

    expect(result).toMatchObject({
      name: periodReport.name,
      period: periodReport.period,
      status: ReportStatus.READY,
      type: ReportType.GENERAL,
      keyMetrics: {
        totalAlerts: 10,
        resolvedAlerts: 7,
        unresolvedAlerts: 3,
        dominantAlertType: AlertType.ENERGY,
        dominantAlertSeverity: AlertSeverity.HIGH,
        resolutionRate: 70,
        totalCostSavedNgn: 50000,
        generatorCostAvoidedNgn: 30000,
        fuelSavedLitres: 20,
        co2AvoidedKg: 15,
        totalActiveHours: 18,
        totalEnergyGeneratedKwh: 90,
        totalEnergyConsumedKwh: 80,
        meta: {
          fuelType: GeneratorFuelType.DIESEL,
          fuelPricePerLitreNgn: 1500,
          assumedGeneratorRatedPowerKw: 12,
          assumedConsumptionRateLPerHr: 2,
        },
        solarKwh: 120,
        avgBatterySoc: 75,
        avgLoadKw: 8,
      },
    });
    expect(result.dateDelivered).toBeInstanceOf(Date);
    expect(result.dateDelivered!.getTime()).toBeGreaterThanOrEqual(
      deliveredBefore.getTime(),
    );
  });

  it('updates a report with key metrics, date delivered, and status', async () => {
    const generalReport = {
      name: periodReport.name,
      period: periodReport.period,
      status: ReportStatus.READY,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
      type: ReportType.GENERAL,
      keyMetrics: {
        totalAlerts: 10,
        resolvedAlerts: 7,
        unresolvedAlerts: 3,
        dominantAlertType: AlertType.ENERGY,
        dominantAlertSeverity: AlertSeverity.HIGH,
        resolutionRate: 70,
        totalCostSavedNgn: 50000,
        generatorCostAvoidedNgn: 30000,
        fuelSavedLitres: 20,
        co2AvoidedKg: 15,
        totalActiveHours: 18,
        totalEnergyGeneratedKwh: 90,
        totalEnergyConsumedKwh: 80,
        meta: {
          fuelType: GeneratorFuelType.DIESEL,
          fuelPricePerLitreNgn: 1500,
          assumedGeneratorRatedPowerKw: 12,
          assumedConsumptionRateLPerHr: 2,
        },
        solarKwh: 120,
        avgBatterySoc: 75,
        avgLoadKw: 8,
      },
    };

    mockReportModelAction.updateReport.mockResolvedValue(periodReport);

    const result = await service.updateReport('report-1', generalReport);

    expect(mockReportModelAction.updateReport).toHaveBeenCalledWith(
      'report-1',
      generalReport.keyMetrics,
      generalReport.status,
    );
    expect(result).toBe(periodReport);
  });
});
