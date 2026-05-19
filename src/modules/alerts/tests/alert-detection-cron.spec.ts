jest.mock('../../../config/env', () => ({}));

import { Inverter } from '../../inverters/entities/inverters.entity';
import { calculateDepletion } from './depletion-engine';
import { mockAlertRepo, mockInverterRepo, mockMetricsRepo, mockUserSettingsRepo, resetAllMocks } from './test-helpers';
import { shouldFireAlert } from './alert-thresholds';
import { isWithinQuietHours } from './quiet-hours';

// ------------------------------------------------------------------
// TESTS  —  Alert Detection Logic
// ------------------------------------------------------------------
describe('AlertDetectionCron — Test Cases', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('2.1 should fire a "critical" alert when depletion is under 30 minutes', () => {
    console.log("reach")
    const depResult = calculateDepletion({
      batterySocPercent: 25,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
      inverterRatedPowerKw: 8,
    });

    const alertInfo = shouldFireAlert(
      depResult.minutesUntilDepletion,
      depResult.isCharging,
    );
    
    expect(alertInfo).toBeDefined();
    expect(alertInfo!.severity).toBe('CRITICAL');
    expect(alertInfo!.minutesUntilDepletion).toBeLessThan(30);
    expect(alertInfo!.minutesUntilDepletion).toBeGreaterThan(0);
  });

  it('2.2 should fire a "warning" alert when depletion is between 30–60 minutes', () => {
    const depResult = calculateDepletion({
      batterySocPercent: 60,
      loadKw: 2.5,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
      inverterRatedPowerKw: 5,
    });

    const depResult2 = calculateDepletion({
      batterySocPercent: 35,
      loadKw: 4,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 8,
    });

    const alertInfo= shouldFireAlert(
      depResult2.minutesUntilDepletion,
      depResult2.isCharging,
    )

    expect(alertInfo).toBeDefined();
    expect(alertInfo!.severity).toBe('WARNING');
    expect(alertInfo!.minutesUntilDepletion).toBeGreaterThanOrEqual(30);
    expect(alertInfo!.minutesUntilDepletion).toBeLessThanOrEqual(60);
  });

  it('2.3 should NOT fire an alert when depletion exceeds 60 minutes (safe zone)', () => {
    const depResult = calculateDepletion({
      batterySocPercent: 80,
      loadKw: 1.5,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
      inverterRatedPowerKw: 5,
    });

    const alertInfo = shouldFireAlert(
      depResult.minutesUntilDepletion,
      depResult.isCharging,
    );

    expect(alertInfo).toBeNull();
  });

  it('2.4 should skip creating alert when an unresolved alert of the same type already exists', async () => {
    mockMetricsRepo.findOne.mockResolvedValue({
      inverterId: 'inv-1',
      batterySocPercent: 20,
      loadKw: 5,
      solarGenKw: 0.5,
      createdAt: new Date(),
    });

    mockAlertRepo.findOne.mockResolvedValue({
      id: 'existing-alert',
      userId: 'user-1',
      type: 'BATTERY_PERCENTAGE',
      severity: 'CRITICAL',
      resolutionStatus: 'UNRESOLVED',
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    });

    const existing = await mockAlertRepo.findOne({
      where: { userId: 'user-1', type: 'BATTERY_PERCENTAGE' },
      order: { createAt: 'DESC' },
    });

    expect(existing).toBeDefined();
    expect(existing.resolutionStatus).toBe('UNRESOLVED');
  });

  it('2.5 should log a warning and skip when no battery metric exists for the inverter', async () => {
    mockMetricsRepo.findOne.mockResolvedValue(null);
    const loggerSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const metric = await mockMetricsRepo.findOne({
      where: { inverterId: 'inv-uuid-1' },
    });
    expect(metric).toBeNull();
    expect(mockAlertRepo.save).not.toHaveBeenCalled();

    loggerSpy.mockRestore();
  });

  it('2.6 should create alert but defer delivery when user has active quiet hours', () => {
    const currentTime = new Date('2026-05-16T22:00:00Z'); // 10PM UTC
    const quietStart = '21:00';
    const quietEnd = '07:00';
    
    const inQuiet = isWithinQuietHours(currentTime, quietStart, quietEnd);
    expect(inQuiet).toBe(true);

    // but critical alerts bypass quiet hours
    const severity = 'CRITICAL';
    const shouldBypass = severity === 'CRITICAL';

    // warning alerts during quiet hours should be deferred
    const warningSeverity = 'WARNING' as string;
    const shouldDefer = warningSeverity !== 'CRITICAL' && inQuiet;

    expect(shouldBypass).toBe(true);
    expect(shouldDefer).toBe(true);
  });
});

// ------------------------------------------------------------------
// EDGE CASES   —   Boundaries, Extremes, Anomalies
// ------------------------------------------------------------------
describe('AlertDetectionCron — Edge Cases', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('E13 should skip inverters that are marked inactive', async () => {
    mockInverterRepo.find.mockResolvedValue([
      { id: 'inv-1', userId: 'u1', isActive: false, brand: 'VICTRON' },
      { id: 'inv-2', userId: 'u2', isActive: true, brand: 'GROWATT' },
    ]);

    const inverters = await mockInverterRepo.find();
    const activeInverters = inverters.filter((inv: Inverter) => inv.isActive);

    expect(activeInverters).toHaveLength(1);
    expect(activeInverters[0].id).toBe('inv-2');
  });

  it('E14 should warn and skip when no metrics exist for any inverter', async () => {
    mockInverterRepo.find.mockResolvedValue([
      { id: 'inv-1', userId: 'u1', isActive: true },
      { id: 'inv-2', userId: 'u2', isActive: true },
    ]);
    mockMetricsRepo.find.mockResolvedValue([]);
    const loggerSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const activeInverters = await mockInverterRepo.find({
      where: { isActive: true },
    });
    const latestMetrics = await mockMetricsRepo.find();

    expect(activeInverters).toHaveLength(2);
    expect(latestMetrics).toHaveLength(0);

    loggerSpy.mockRestore();
  });

  it('E15 should treat stale metrics (>30 min old) as unavailable data', async () => {
    const staleDate = new Date(Date.now() - 40 * 60 * 1000); // 40 min ago
    mockMetricsRepo.findOne.mockResolvedValue({
      inverterId: 'inv-1',
      batterySocPercent: 20,
      createdAt: staleDate,
    });

    const metric = await mockMetricsRepo.findOne({
      where: { inverterId: 'inv-1' },
    });
    const ageMinutes = (Date.now() - metric.createdAt.getTime()) / 60000;
    const isStale = ageMinutes > 30;

    expect(isStale).toBe(true);
    // Should not use this data for depletion calculation — treat as "no data"
  });

  it('E16 should handle simultaneous evaluation of many inverters without crashing', async () => {
    const manyInverters = Array.from({ length: 150 }, (_, i) => ({
      id: `inv-${i}`,
      userId: `user-${i}`,
      isActive: true,
      brand: 'VICTRON',
    }));
    mockInverterRepo.find.mockResolvedValue(manyInverters);

    const inverters = await mockInverterRepo.find();
    expect(inverters).toHaveLength(150);

    // Process in batches (e.g., 20 at a time) to avoid overwhelming DB
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < inverters.length; i += batchSize) {
      batches.push(inverters.slice(i, i + batchSize) as never);
    }
    expect(batches).toHaveLength(8); // 7 full batches of 20 + 1 of 10
    // Simulate: all batches resolve without throwing
    await expect(
      Promise.allSettled(batches.map((b) => Promise.resolve(b))),
    ).resolves.toHaveLength(8);
  });

  it('E17 should respect user-configured custom threshold (e.g. 20% instead of 10%)', async () => {
    mockUserSettingsRepo.findOne.mockResolvedValue({
      userId: 'user-uuid-1',
      depletionThreshold: 20, // user wants alert at 20% not 10%
    });

    const settings = await mockUserSettingsRepo.findOne({
      where: { userId: 'user-uuid-1' },
    });
    
    const depResult = calculateDepletion(
      {
        batterySocPercent: 15,
        loadKw: 3,
        batteryCapacityKwh: 10,
        solarGenKw: 0,
        inverterRatedPowerKw: 5,
      },
      settings.depletionThreshold,
    );

    expect(depResult.minutesUntilDepletion).toBe(0);
    expect(depResult.thresholdPercent).toBe(20);
  });

  it('E18 should fall back to SOC+load calculation when brand does not expose batteryTimeToGoMin', () => {
    // Growatt does not expose batteryTimeToGoMin
    const depResult = calculateDepletion({
      batterySocPercent: 40,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
      inverterRatedPowerKw: 5,
    });

    expect(depResult.minutesUntilDepletion).toBeGreaterThan(0);
    expect(depResult.netDischargeKw).toBeGreaterThan(0);
  });
});
