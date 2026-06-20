jest.mock('../../../config/env', () => ({}));
jest.mock('../../../config/app.config', () => ({ appConfig: { KEY: 'app' } }));

import { ConflictException } from '@nestjs/common';
import { AlertSeverity, AlertType } from '../../../common/enums';
import { SYS_MSG } from '../../../common/constants/sys-msg';
import { GeneratorFuelType } from '../../../common/enums/generator';
import {
  ReportPeriod,
  ReportStatus,
  ReportType,
} from '../../../common/enums/reports.type';
import { Report } from '../entities/report.entity';
import { REPORT_JOBS } from '../reports.jobs';
import { ReportProcessor } from '../reports.processor';

interface MockJob<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  data: T;
}

function makeJob<T extends Record<string, unknown>>(
  name: string,
  data: T,
): MockJob<T> {
  return {
    id: 'job-1',
    name,
    data,
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    userId: 'user-1',
    inverterId: 'inverter-1',
    name: 'June report',
    type: ReportType.ALERT,
    period: ReportPeriod.MONTHLY,
    referenceDate: new Date('2026-06-01T00:00:00.000Z'),
    dateDelivered: null,
    status: ReportStatus.PROCESSING,
    keyMetrics: {
      totalAlerts: 2,
      resolvedAlerts: 1,
      unresolvedAlerts: 1,
      dominantAlertType: AlertType.ENERGY,
      dominantAlertSeverity: AlertSeverity.HIGH,
      resolutionRate: 50,
    },
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  } as Report;
}

function makeProcessedReport(
  type: ReportType,
  keyMetrics: Record<string, unknown>,
) {
  return {
    name: 'June report',
    period: ReportPeriod.MONTHLY,
    status: ReportStatus.READY,
    dateDelivered: new Date('2026-06-02T00:00:00.000Z'),
    type,
    keyMetrics,
  };
}

function makeReportsService() {
  return {
    getReportById: jest.fn(),
    computeAlertReport: jest.fn(),
    computeCostAndSavingsReport: jest.fn(),
    computeSolarReport: jest.fn(),
    computeGeneralReport: jest.fn(),
    updateReport: jest.fn(),
  };
}

function makeEmailService() {
  return {
    sendWelcome: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendPasswordUpdate: jest.fn(),
    sendLinkExpire: jest.fn(),
    sendVerifyEmail: jest.fn(),
    sendContactUs: jest.fn(),
    sendAlert: jest.fn(),
    sendWaitlistJoinedEmail: jest.fn(),
    sendReportEmail: jest.fn(),
  };
}

function makeProcessor() {
  const reportsService = makeReportsService();
  const emailService = makeEmailService();
  const processor = new ReportProcessor(
    reportsService as never,
    emailService as never,
  );

  return {
    processor,
    reportsService,
    emailService,
  };
}

describe('ReportProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    const { processor } = makeProcessor();

    expect(processor).toBeDefined();
  });

  it('carries out send-report jobs', async () => {
    const { processor, reportsService, emailService } = makeProcessor();

    const report = makeReport({ type: ReportType.ALERT });
    const processed = makeProcessedReport(ReportType.ALERT, {
      totalAlerts: 10,
      resolvedAlerts: 7,
      unresolvedAlerts: 3,
      dominantAlertType: AlertType.ENERGY,
      dominantAlertSeverity: AlertSeverity.HIGH,
      resolutionRate: 70,
    });

    reportsService.getReportById.mockResolvedValue(report);
    reportsService.computeAlertReport.mockResolvedValue(processed);

    const processVars = {
      to: 'user@gmail.com',
      firstName: 'firstName',
      clientUrl: `https://client-url`,
      reportPdf: Buffer.from([]),
      type: report.type,
      dateDelivered: new Date('2026-06-02T00:00:00.000Z').toISOString(),
    };

    await processor.process(
      makeJob(REPORT_JOBS.SEND_REPORT, {
        ...processVars,
      }) as never,
    );

    expect(emailService.sendReportEmail).toHaveBeenCalledWith(
      processVars.reportPdf,
      processVars.to,
      processVars.clientUrl,
      processVars.firstName,
      processVars.type,
      processVars.dateDelivered,
    );
  });

  it('throws for unknown job types', async () => {
    const { processor } = makeProcessor();

    await expect(
      processor.process(
        makeJob('unknown-job', {
          reportId: 'report-1',
        }) as never,
      ),
    ).rejects.toThrow('Unknown job type: unknown-job');
  });

  it('throws when the report does not exist', async () => {
    const { processor, reportsService } = makeProcessor();
    reportsService.getReportById.mockResolvedValue(null);

    await expect(
      processor.process(
        makeJob(REPORT_JOBS.COMPUTE_REPORT, {
          reportId: 'missing-report',
        }) as never,
      ),
    ).rejects.toThrow('No report with id missing-report found');

    expect(reportsService.updateReport).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the report is already ready', async () => {
    const { processor, reportsService } = makeProcessor();
    reportsService.getReportById.mockResolvedValue(
      makeReport({ status: ReportStatus.READY }),
    );

    await expect(
      processor.process(
        makeJob(REPORT_JOBS.COMPUTE_REPORT, {
          reportId: 'report-1',
        }) as never,
      ),
    ).rejects.toThrow(ConflictException);

    await expect(
      processor.process(
        makeJob(REPORT_JOBS.COMPUTE_REPORT, {
          reportId: 'report-1',
        }) as never,
      ),
    ).rejects.toThrow(SYS_MSG.CONFLICT);

    expect(reportsService.updateReport).not.toHaveBeenCalled();
  });

  it('processes alert reports and persists the result', async () => {
    const { processor, reportsService } = makeProcessor();
    const report = makeReport({ type: ReportType.ALERT });
    const processed = makeProcessedReport(ReportType.ALERT, {
      totalAlerts: 10,
      resolvedAlerts: 7,
      unresolvedAlerts: 3,
      dominantAlertType: AlertType.ENERGY,
      dominantAlertSeverity: AlertSeverity.HIGH,
      resolutionRate: 70,
    });

    reportsService.getReportById.mockResolvedValue(report);
    reportsService.computeAlertReport.mockResolvedValue(processed);
    await processor.process(
      makeJob(REPORT_JOBS.COMPUTE_REPORT, {
        reportId: report.id,
        processed,
      }) as never,
    );

    expect(reportsService.computeAlertReport).toHaveBeenCalledWith(report);
    expect(reportsService.computeCostAndSavingsReport).not.toHaveBeenCalled();
    expect(reportsService.computeSolarReport).not.toHaveBeenCalled();
    expect(reportsService.computeGeneralReport).not.toHaveBeenCalled();
    expect(reportsService.updateReport).toHaveBeenCalledWith(
      report.id,
      processed,
      new Date('2026-06-02T00:00:00.000Z'),
    );
  });

  it('processes cost and savings reports and persists the result', async () => {
    const { processor, reportsService } = makeProcessor();
    const report = makeReport({ type: ReportType.CSC });
    const processed = makeProcessedReport(ReportType.CSC, {
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
    });

    reportsService.getReportById.mockResolvedValue(report);
    reportsService.computeCostAndSavingsReport.mockResolvedValue(processed);

    await processor.process(
      makeJob(REPORT_JOBS.COMPUTE_REPORT, {
        reportId: report.id,
      }) as never,
    );

    expect(reportsService.computeCostAndSavingsReport).toHaveBeenCalledWith(
      report,
    );
    expect(reportsService.computeAlertReport).not.toHaveBeenCalled();
    expect(reportsService.computeSolarReport).not.toHaveBeenCalled();
    expect(reportsService.computeGeneralReport).not.toHaveBeenCalled();
    expect(reportsService.updateReport).toHaveBeenCalledWith(
      report.id,
      processed,
      new Date('2026-06-02T00:00:00.000Z'),
    );
  });

  it('processes solar reports and persists the result', async () => {
    const { processor, reportsService } = makeProcessor();
    const report = makeReport({ type: ReportType.SOLAR });
    const processed = makeProcessedReport(ReportType.SOLAR, {
      solarKwh: 120,
      avgBatterySoc: 75,
      avgLoadKw: 8,
      totalActiveHours: 18,
    });

    reportsService.getReportById.mockResolvedValue(report);
    reportsService.computeSolarReport.mockResolvedValue(processed);

    await processor.process(
      makeJob(REPORT_JOBS.COMPUTE_REPORT, {
        reportId: report.id,
      }) as never,
    );

    expect(reportsService.computeSolarReport).toHaveBeenCalledWith(report);
    expect(reportsService.computeAlertReport).not.toHaveBeenCalled();
    expect(reportsService.computeCostAndSavingsReport).not.toHaveBeenCalled();
    expect(reportsService.computeGeneralReport).not.toHaveBeenCalled();
    expect(reportsService.updateReport).toHaveBeenCalledWith(
      report.id,
      processed,
      new Date('2026-06-02T00:00:00.000Z'),
    );
  });

  it('processes general reports and persists the result', async () => {
    const { processor, reportsService } = makeProcessor();
    const report = makeReport({ type: ReportType.GENERAL });
    const processed = makeProcessedReport(ReportType.GENERAL, {
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
      solarKwh: 120,
      avgBatterySoc: 75,
      avgLoadKw: 8,
      meta: {
        fuelType: GeneratorFuelType.DIESEL,
        fuelPricePerLitreNgn: 1500,
        assumedGeneratorRatedPowerKw: 12,
        assumedConsumptionRateLPerHr: 2,
      },
    });

    reportsService.getReportById.mockResolvedValue(report);
    reportsService.computeGeneralReport.mockResolvedValue(processed);

    await processor.process(
      makeJob(REPORT_JOBS.COMPUTE_REPORT, {
        reportId: report.id,
      }) as never,
    );

    expect(reportsService.computeGeneralReport).toHaveBeenCalledWith(report);
    expect(reportsService.computeAlertReport).not.toHaveBeenCalled();
    expect(reportsService.computeCostAndSavingsReport).not.toHaveBeenCalled();
    expect(reportsService.computeSolarReport).not.toHaveBeenCalled();
    expect(reportsService.updateReport).toHaveBeenCalledWith(
      report.id,
      processed,
      new Date('2026-06-02T00:00:00.000Z'),
    );
  });

  it('marks the report as failed when computation throws', async () => {
    const { processor, reportsService } = makeProcessor();
    const report = makeReport({ type: ReportType.SOLAR });

    reportsService.getReportById.mockResolvedValue(report);
    reportsService.computeSolarReport.mockRejectedValue(
      new Error('solar aggregation failed'),
    );

    await expect(
      processor.process(
        makeJob(REPORT_JOBS.COMPUTE_REPORT, {
          reportId: report.id,
        }) as never,
      ),
    ).rejects.toThrow('solar aggregation failed');

    expect(reportsService.updateReport).toHaveBeenCalledWith(
      report.id,
      expect.objectContaining({
        id: report.id,
        type: ReportType.SOLAR,
        status: ReportStatus.FAILED,
        keyMetrics: report.keyMetrics,
      }),
      null,
    );
  });

  it('marks the report as failed when the report type is unknown', async () => {
    const { processor, reportsService } = makeProcessor();
    const report = makeReport({ type: 'UNKNOWN' as ReportType });

    reportsService.getReportById.mockResolvedValue(report);

    await expect(
      processor.process(
        makeJob(REPORT_JOBS.COMPUTE_REPORT, {
          reportId: report.id,
        }) as never,
      ),
    ).rejects.toThrow('Unknown report type');

    expect(reportsService.updateReport).toHaveBeenCalledWith(
      report.id,
      expect.objectContaining({
        id: report.id,
        type: 'UNKNOWN',
        status: ReportStatus.FAILED,
      }),
      null,
    );
  });
});
