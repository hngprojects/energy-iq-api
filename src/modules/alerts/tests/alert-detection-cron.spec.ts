// ==================================================================
// ALERT DETECTION JOB — Redis pub/sub triggered detection
// Tests for AlertDetectionJob in jobs/alert-detection.job.ts
//
// The job subscribes to 'inverter:*' on startup, receives
// NormalisedMetric payloads, and creates alerts via BullMQ.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { AlertDetectionJob } from '../jobs/alert-detection.job';
import {
  AlertSeverity,
  AlertResolutionStatus,
  AlertType,
} from '../../../common/enums';
import {
  InverterBrand,
  InverterApiType,
} from '../../../common/enums/inverter-brand.enum';
import { ProcessingStatus } from '../../../common/constants/processing-status';
import { ALERT_DEFERRED_DELIVERY_JOB } from '../jobs/alert-dispatch.jobs';
import { NormalisedMetric } from '../../inverters/types/shared.types';
import { MetricsPubSubService } from '../../metrics-stream/pubsub/metrics-pubsub.service';
import { Repository } from 'typeorm';
import { Inverter } from '../../inverters/entities/inverters.entity';
import { UserSettings } from '../../users/entities/user-settings.entity';
import { Alert } from '../entities/alert.entity';
import { DuplicateSuppressionService } from '../helpers/duplicate-suppression';
import { Queue } from 'bullmq';

// ------------------------------------------------------------------
// Shared fixtures
// ------------------------------------------------------------------

const makeMetric = (
  overrides: Partial<NormalisedMetric> = {},
): NormalisedMetric => ({
  inverterId: 'inv-uuid-1',
  inverterBrand: InverterBrand.VICTRON,
  recordedAt: new Date().toISOString(),
  inverterStatus: 'normal',
  batterySoc: 20, // low enough to trigger CRITICAL with default threshold
  acOutputPowerKw: 5,
  solarPowerKw: 0,
  gridVoltageV: null,
  gridFrequencyHz: null,
  batteryVoltageV: null,
  batteryCurrentA: null,
  batteryTemperatureC: null,
  batteryTimeToGoMin: null,
  inverterTemperatureC: null,
  pvString1PowerKw: null,
  pvString2PowerKw: null,
  energyGeneratedTodayKwh: null,
  totalEnergyGeneratedKwh: null,
  batteryChargedTodayKwh: null,
  batteryDischargedTodayKwh: null,
  gridExportTodayKwh: null,
  gridImportTodayKwh: null,
  ...overrides,
});

const makeInverter = (overrides: Partial<any> = {}) => ({
  id: 'inv-uuid-1',
  userId: 'user-uuid-1',
  brand: InverterBrand.VICTRON,
  model: 'SmartSolar',
  serialNumber: 'SN-001',
  apiType: InverterApiType.LIVE_API,
  isActive: true,
  ratedCapacityKwh: 10,
  panelCapacityKw: 8,
  ...overrides,
});

const makeSettings = (overrides: Partial<any> = {}) => ({
  depletionThreshold: 10,
  alertCooldownMinutes: 15,
  timezone: '+00:00',
  quietHoursStart: null,
  quietHoursEnd: null,
  ...overrides,
});

const makeSavedAlert = (overrides: Partial<any> = {}) => ({
  id: 'alert-uuid-1',
  userId: 'user-uuid-1',
  type: AlertType.BATTERY_PERCENTAGE,
  severity: AlertSeverity.CRITICAL,
  message: 'Battery depletion imminent',
  resolutionStatus: AlertResolutionStatus.UNRESOLVED,
  deliveryProcessingStatus: ProcessingStatus.pending,
  deliverable: true,
  deliveryStatus: 'pending',
  ...overrides,
});

// ------------------------------------------------------------------
// Mock factory — builds a fresh AlertDetectionJob with all deps mocked
// ------------------------------------------------------------------

function makeJob() {
  const inverterRepo = {
    findOne: jest.fn(),
  };
  const userSettingsRepo = {
    findOne: jest.fn(),
  };
  const alertRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const duplicateSuppression = {
    isDuplicate: jest.fn(),
  };
  const pubSubService = {
    psubscribe: jest.fn().mockResolvedValue(undefined),
    punsubscribe: jest.fn().mockResolvedValue(undefined),
  };
  const alertQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const job = new AlertDetectionJob(
    inverterRepo as unknown as Repository<Inverter>,
    userSettingsRepo as unknown as Repository<UserSettings>,
    alertRepo as unknown as Repository<Alert>,
    duplicateSuppression as any as DuplicateSuppressionService,
    pubSubService as unknown as MetricsPubSubService,
    alertQueue as unknown as Queue,
  );

  return {
    job,
    inverterRepo,
    userSettingsRepo,
    alertRepo,
    duplicateSuppression,
    pubSubService,
    alertQueue,
  };
}

// ------------------------------------------------------------------
// Helper: trigger the private handleMetricMessage via the bound handler
// ------------------------------------------------------------------
async function triggerMessage(
  job: AlertDetectionJob,
  metric: NormalisedMetric,
  channel = 'inverter:inv-uuid-1',
) {
  // Access the bound metricHandler stored on the instance
  const handler = (
    job as unknown as { metricHandler: (msg: string, ch: string) => void }
  ).metricHandler;
  handler(JSON.stringify(metric), channel);
  // evaluateFromMetric is fire-and-forget (void), so we flush the microtask queue
  await new Promise((resolve) => setImmediate(resolve));
}

// ------------------------------------------------------------------
// TESTS  (3.1 – 3.12)   —   Core Detection Logic
// ------------------------------------------------------------------
describe('AlertDetectionJob — Test Cases', () => {
  it('3.1 should subscribe to inverter:* on module init', async () => {
    const { job, pubSubService } = makeJob();

    await job.onModuleInit();

    expect(pubSubService.psubscribe).toHaveBeenCalledTimes(1);
    expect(pubSubService.psubscribe).toHaveBeenCalledWith(
      'inverter:*',
      expect.any(Function),
    );
  });

  it('3.2 should unsubscribe from inverter:* on module destroy', async () => {
    const { job, pubSubService } = makeJob();

    await job.onModuleDestroy();

    expect(pubSubService.punsubscribe).toHaveBeenCalledTimes(1);
    expect(pubSubService.punsubscribe).toHaveBeenCalledWith(
      'inverter:*',
      expect.any(Function),
    );
  });

  it('3.3 should not crash and not save alert when JSON is malformed', async () => {
    const { job, alertRepo } = makeJob();

    const handler = (
      job as unknown as { metricHandler: (msg: string, ch: string) => void }
    ).metricHandler;
    // Should not throw
    expect(() => handler('not-valid-json', 'inverter:abc')).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('3.4 should skip evaluation when inverter is not found in DB', async () => {
    const { job, inverterRepo, alertRepo } = makeJob();
    inverterRepo.findOne.mockResolvedValue(null);

    await triggerMessage(job, makeMetric());

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('3.5 should skip evaluation when inverter is inactive', async () => {
    const { job, inverterRepo, alertRepo } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter({ isActive: false }));

    await triggerMessage(job, makeMetric());

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('3.6 should not create alert when depletion is in safe zone (>60 min)', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    userSettingsRepo.findOne.mockResolvedValue(makeSettings());
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });

    // SOC=90%, load=1kW, solar=0 → depletion ~720min → safe zone
    await triggerMessage(
      job,
      makeMetric({ batterySoc: 90, acOutputPowerKw: 1, solarPowerKw: 0 }),
    );

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('3.7 should not create alert when duplicate suppression returns isDuplicate=true', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    userSettingsRepo.findOne.mockResolvedValue(makeSettings());
    duplicateSuppression.isDuplicate.mockResolvedValue({
      isDuplicate: true,
      reason: 'unresolved_alert_exists',
    });

    await triggerMessage(job, makeMetric());

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('3.8 should create alert and queue alert.dispatch when all conditions met and not quiet hours', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
      alertQueue,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    userSettingsRepo.findOne.mockResolvedValue(makeSettings());
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });
    alertRepo.create.mockReturnValue(makeSavedAlert());
    alertRepo.save.mockResolvedValue(makeSavedAlert());

    await triggerMessage(job, makeMetric());

    expect(alertRepo.save).toHaveBeenCalledTimes(1);
    expect(alertQueue.add).toHaveBeenCalledWith(
      'alert.dispatch',
      expect.objectContaining({
        alertId: 'alert-uuid-1',
        userId: 'user-uuid-1',
        channel: 'whatsapp',
      }),
    );
  });

  it('3.9 should queue deferred job with delay when WARNING alert fires during quiet hours', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
      alertQueue,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    // SOC=35%, load=4kW → ~37.5min → WARNING
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: '+00:00',
      }),
    );
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });
    const savedAlert = makeSavedAlert({
      severity: AlertSeverity.WARNING,
      deliverable: false,
    });
    alertRepo.create.mockReturnValue(savedAlert);
    alertRepo.save.mockResolvedValue(savedAlert);

    const fixedTimestamp = new Date('2026-01-01T22:30:00Z').getTime();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);
    const RealDate = Date;
    const dateSpy = jest.spyOn(global, 'Date').mockImplementation(function (
      this: unknown,
      ...args: (string | number | Date)[]
    ) {
      if (args.length === 0) return new RealDate(fixedTimestamp);
      return new RealDate(args[0]);
    });
    jest.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);

    await triggerMessage(
      job,
      makeMetric({ batterySoc: 35, acOutputPowerKw: 4, solarPowerKw: 0 }),
    );

    expect(alertQueue.add).toHaveBeenCalledWith(
      ALERT_DEFERRED_DELIVERY_JOB,
      expect.objectContaining({ alertId: savedAlert.id }),
      expect.objectContaining({ delay: expect.any(Number) as number }),
    );
    const callArgs = alertQueue.add.mock.calls[0] as [
      string,
      unknown,
      { delay: number },
    ];
    expect(callArgs[2].delay).toBeGreaterThan(0);

    dateSpy.mockRestore();
    nowSpy.mockRestore();
  }, 15000);

  it('3.10 should queue alert.dispatch immediately for CRITICAL alert even during quiet hours', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
      alertQueue,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    // SOC=20%, load=5kW → ~12min → CRITICAL
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: '+00:00',
      }),
    );
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });
    const savedAlert = makeSavedAlert({
      severity: AlertSeverity.CRITICAL,
      deliverable: true,
    });
    alertRepo.create.mockReturnValue(savedAlert);
    alertRepo.save.mockResolvedValue(savedAlert);

    const fixedTimestamp = new Date('2026-01-01T22:30:00Z').getTime();
    const RealDate = Date;
    const dateSpy = jest.spyOn(global, 'Date').mockImplementation(function (
      this: unknown,
      ...args: (string | number | Date)[]
    ) {
      if (args.length === 0) return new RealDate(fixedTimestamp);
      return new RealDate(args[0]);
    });
    jest.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);

    await triggerMessage(
      job,
      makeMetric({ batterySoc: 20, acOutputPowerKw: 5, solarPowerKw: 0 }),
    );

    // CRITICAL bypasses quiet hours → immediate dispatch, not deferred
    expect(alertQueue.add).toHaveBeenCalledWith(
      'alert.dispatch',
      expect.objectContaining({ alertId: savedAlert.id }),
    );
    expect(alertQueue.add).not.toHaveBeenCalledWith(
      ALERT_DEFERRED_DELIVERY_JOB,
      expect.anything(),
      expect.anything(),
    );

    dateSpy.mockRestore();
  });

  it('3.11 should use user-configured custom threshold when evaluating depletion', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
      alertQueue,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    // Custom threshold of 20% — SOC=15% is below it → alert fires
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ depletionThreshold: 20 }),
    );
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });
    alertRepo.create.mockReturnValue(makeSavedAlert());
    alertRepo.save.mockResolvedValue(makeSavedAlert());

    // SOC=15% is below threshold=20% → minutesUntilDepletion=0 → CRITICAL
    await triggerMessage(
      job,
      makeMetric({ batterySoc: 15, acOutputPowerKw: 3, solarPowerKw: 0 }),
    );

    expect(alertRepo.save).toHaveBeenCalledTimes(1);
    expect(alertQueue.add).toHaveBeenCalledWith(
      'alert.dispatch',
      expect.anything(),
    );
  });

  it('3.12 should handle null metric fields (Growatt brand) without crashing', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(
      makeInverter({ brand: InverterBrand.GROWATT }),
    );
    userSettingsRepo.findOne.mockResolvedValue(makeSettings());
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });
    alertRepo.create.mockReturnValue(makeSavedAlert());
    alertRepo.save.mockResolvedValue(makeSavedAlert());

    // Growatt doesn't expose batteryTemperatureC, batteryTimeToGoMin, batteryCurrentA
    const growattMetric = makeMetric({
      batterySoc: 20,
      acOutputPowerKw: 5,
      solarPowerKw: 0,
      batteryTemperatureC: null,
      batteryTimeToGoMin: null,
      batteryCurrentA: null,
    });

    // Should not throw
    await expect(triggerMessage(job, growattMetric)).resolves.not.toThrow();
  });
});

// ------------------------------------------------------------------
// EDGE CASES  (E13, E17, E18)
// ------------------------------------------------------------------
describe('AlertDetectionJob — Edge Cases', () => {
  it('E13 should skip inactive inverter without creating any alert', async () => {
    const { job, inverterRepo, alertRepo } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter({ isActive: false }));

    await triggerMessage(job, makeMetric());

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('E17 should respect user-configured threshold of 20% — SOC=15% triggers alert', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
      alertQueue,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ depletionThreshold: 20 }),
    );
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });
    alertRepo.create.mockReturnValue(makeSavedAlert());
    alertRepo.save.mockResolvedValue(makeSavedAlert());

    await triggerMessage(
      job,
      makeMetric({ batterySoc: 15, acOutputPowerKw: 3, solarPowerKw: 0 }),
    );

    expect(alertRepo.save).toHaveBeenCalledTimes(1);
    expect(alertQueue.add).toHaveBeenCalled();
  });

  it('E17b should NOT trigger alert when SOC is above custom threshold', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(makeInverter());
    // Threshold=20%, SOC=80% → safe zone
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ depletionThreshold: 20 }),
    );
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });

    await triggerMessage(
      job,
      makeMetric({ batterySoc: 80, acOutputPowerKw: 1, solarPowerKw: 0 }),
    );

    expect(alertRepo.save).not.toHaveBeenCalled();
  });

  it('E18 should calculate depletion from SOC+load when brand-specific fields are null', async () => {
    const {
      job,
      inverterRepo,
      userSettingsRepo,
      alertRepo,
      duplicateSuppression,
      alertQueue,
    } = makeJob();
    inverterRepo.findOne.mockResolvedValue(
      makeInverter({ brand: InverterBrand.GROWATT }),
    );
    userSettingsRepo.findOne.mockResolvedValue(makeSettings());
    duplicateSuppression.isDuplicate.mockResolvedValue({ isDuplicate: false });
    alertRepo.create.mockReturnValue(makeSavedAlert());
    alertRepo.save.mockResolvedValue(makeSavedAlert());

    // batteryTimeToGoMin is null — engine must use SOC+load fallback
    await triggerMessage(
      job,
      makeMetric({
        batterySoc: 20,
        acOutputPowerKw: 5,
        solarPowerKw: 0,
        batteryTimeToGoMin: null,
      }),
    );

    // Alert should still fire based on SOC+load calculation
    expect(alertRepo.save).toHaveBeenCalledTimes(1);
    expect(alertQueue.add).toHaveBeenCalled();
  });
});
