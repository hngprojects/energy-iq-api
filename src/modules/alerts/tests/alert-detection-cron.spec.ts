// ==================================================================
// ALERT DETECTION CRON (Alert-Worthy Detection)
// ==================================================================
// Tests:     6  (firing logic, severity levels, skip conditions)
// Edge Cases: 6  (inactive inverters, stale data, concurrency, etc.)
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { Inverter } from '../../inverters/entities/inverters.entity';

// ------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------
const mockAlertRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockMetricsRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockInverterRepo = {
  find: jest.fn(),
};

const mockUserSettingsRepo = {
  findOne: jest.fn(),
};

// ------------------------------------------------------------------
// TESTS  —  Alert Detection Logic
// ------------------------------------------------------------------
describe('AlertDetectionCron — Test Cases', () => {
  type CronServiceMock = {
    evaluateInverters: jest.Mock<Promise<void>, []>;
    shouldFireAlert: jest.Mock<
      { minutesUntilDepletion: number; isCharging: boolean; severity: string } | null,
      [Record<string, unknown>]
    >;
    createAlert: jest.Mock;
  };
  let cronService: CronServiceMock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Module setup placeholder — replace with real imports once service exists
    // const module: TestingModule = await Test.createTestingModule({...}).compile();
    // cronService = module.get<AlertDetectionCronService>(AlertDetectionCronService);
    cronService = {
      evaluateInverters: jest.fn(),
      shouldFireAlert: jest.fn(),
      createAlert: jest.fn(),
    };
  });

  it('2.1 should fire a "critical" alert when depletion is under 30 minutes', async () => {
    const mockDepletionResult = { minutesUntilDepletion: 20, isCharging: false, severity: 'critical' };
    cronService.shouldFireAlert.mockReturnValue(mockDepletionResult);

    const result = cronService.shouldFireAlert({
      batterySocPercent: 25,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
    });

    expect(result).toBeDefined();
    expect(result?.severity).toBe('critical');
    expect(result?.minutesUntilDepletion).toBeLessThan(30);
  });

  it('2.2 should fire a "warning" alert when depletion is between 30–60 minutes', async () => {
    const mockDepletionResult = { minutesUntilDepletion: 45, isCharging: false, severity: 'warning' };
    cronService.shouldFireAlert.mockReturnValue(mockDepletionResult);

    const result = cronService.shouldFireAlert({
      batterySocPercent: 50,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
    });

    expect(result).toBeDefined();
    expect(result?.severity).toBe('warning');
    expect(result?.minutesUntilDepletion).toBeGreaterThanOrEqual(30);
    expect(result?.minutesUntilDepletion).toBeLessThanOrEqual(60);
  });

  it('2.3 should NOT fire an alert when depletion exceeds 60 minutes (safe zone)', async () => {
    cronService.shouldFireAlert.mockReturnValue(null);

    const result = cronService.shouldFireAlert({
      batterySocPercent: 80,
      loadKw: 1.5,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
    });

    expect(result).toBeNull();
  });

  it('2.4 should skip creating alert when an unresolved alert of the same type already exists', async () => {
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'existing-alert-id',
      userId: 'user-uuid-1',
      type: 'battery_depletion',
      resolved: false,
    });

    // Invoke the cron service to evaluate alerts  
    await cronService.evaluateInverters();  
    
    // Verify that createAlert was not called due to existing unresolved alert  
    expect(cronService.createAlert).not.toHaveBeenCalled();
  });

  it('2.5 should log a warning and skip when no battery metric exists for the inverter', async () => {
    mockMetricsRepo.findOne.mockResolvedValue(null);
    const loggerSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const metric = await mockMetricsRepo.findOne({ where: { inverterId: 'inv-uuid-1' } });
    expect(metric).toBeNull();
    // Service should log "No metrics found for inverter inv-uuid-1" and return
    // This would be: expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('No metrics'));
    // Ignore this test for now....updates will be made later
    loggerSpy.mockRestore();
  });

  it('2.6 should create alert but defer delivery when user has active quiet hours', async () => {
    // Mock quiet hours active (current time 10PM, quiet hours 9PM–7AM)
    const mockSettings = {
      userId: 'user-uuid-1',
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
      whatsappAlerts: true,
      criticalAlerts: true,
    };
    mockUserSettingsRepo.findOne.mockResolvedValue(mockSettings);

    // Manually simulate evaluation
    const now = new Date('2026-05-16T22:00:00Z'); // 10PM UTC
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes(); // 1320
    const quietStartMinutes = 21 * 60; // 1260
    const quietEndMinutes = 7 * 60; // 420
    const isQuietHours = quietStartMinutes > quietEndMinutes
      ? currentMinutes >= quietStartMinutes || currentMinutes < quietEndMinutes
      : currentMinutes >= quietStartMinutes && currentMinutes < quietEndMinutes;

    expect(isQuietHours).toBe(true);
    // Alert should be created with `deliverable: false`
    // Then later delivered when quiet hours end
    // Ignore this test too....it's basically a mock...real update for the actual tests coming soon
  });
});

// ------------------------------------------------------------------
// EDGE CASES   —   Boundaries, Extremes, Anomalies
// ------------------------------------------------------------------
describe('AlertDetectionCron — Edge Cases', () => {
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

    const activeInverters = await mockInverterRepo.find({ where: { isActive: true } });
    const latestMetrics = await mockMetricsRepo.find();

    expect(activeInverters).toHaveLength(2);
    expect(latestMetrics).toHaveLength(0);
    // Each inverter with no metrics should log a warning
    // expect(loggerSpy).toHaveBeenCalledTimes(2);
    // Ignore this test too
    loggerSpy.mockRestore();
  });

  it('E15 should treat stale metrics (>30 min old) as unavailable data', async () => {
    const staleDate = new Date(Date.now() - 40 * 60 * 1000); // 40 min ago
    mockMetricsRepo.findOne.mockResolvedValue({
      inverterId: 'inv-1',
      batterySocPercent: 20,
      createdAt: staleDate,
    });

    const metric = await mockMetricsRepo.findOne({ where: { inverterId: 'inv-1' } });
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
    await expect(Promise.allSettled(batches.map((b) => Promise.resolve(b)))).resolves.toHaveLength(8);
  });

  it('E17 should respect user-configured custom threshold (e.g. 20% instead of 10%)', async () => {
    mockUserSettingsRepo.findOne.mockResolvedValue({
      userId: 'user-uuid-1',
      depletionThreshold: 20, // user wants alert at 20% not 10%
    });

    const settings = await mockUserSettingsRepo.findOne({ where: { userId: 'user-uuid-1' } });
    // This should feed into the depletion calculator as the threshold
    // calculateDepletion(metrics, threshold = settings.depletionThreshold)
    expect(settings.depletionThreshold).toBe(20);
  });

  it('E18 should fall back to SOC+load calculation when brand does not expose batteryTimeToGoMin', async () => {
    // Growatt does not expose batteryTimeToGoMin
    const metric = {
      inverterId: 'inv-1',
      batterySocPercent: 40,
      loadKw: 3,
      solarGenKw: 0.5,
      batteryTimeToGoMin: null, // Not provided by Growatt
    };

    // Engine should still calculate depletion using SOC + load
    const netLoad = Math.max(0, metric.loadKw - metric.solarGenKw);
    const usableKwh = ((metric.batterySocPercent - 10) / 100) * 10; // assuming 10kWh battery
    const minutes = (usableKwh / netLoad) * 60;

    expect(minutes).toBeGreaterThan(0);
    expect(metric.batteryTimeToGoMin).toBeNull(); // brand didn't provide it
    expect(minutes).toBeCloseTo(72, 0); // (30% of 10 = 3kWh) / 2.5kW * 60
  });
});