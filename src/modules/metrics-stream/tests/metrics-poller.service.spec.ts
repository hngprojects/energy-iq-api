jest.mock('../../../config/env', () => ({}));
jest.mock('../../../config/app.config', () => ({
  appConfig: { KEY: 'app' },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fc from 'fast-check';
import { MetricsPollerService } from '../poller/metrics-poller.service';
import { VictronAdapter } from '../../inverters/adapters/victron.adapters';
import { GrowattAdapter } from '../../inverters/adapters/growatt.adapter';
import { SunsynkAdapter } from '../../inverters/adapters/sunsynk.adapter';
import { SandboxAdapter } from '../../inverters/adapters/sandbox.adapter';
import { InverterModelAction } from '../../inverters/action/inverters.action';
import { InvertersMetrics } from '../../inverters-metrics/entities/inverters-metrics.entity';
import { MetricsPubSubService } from '../pubsub/metrics-pubsub.service';
import { BrandApiException } from '../../inverters/types/brand-api.exception';
import { NormalisedMetric } from '../../inverters/types/shared.types';
import { Inverter } from '../../inverters/entities/inverters.entity';
import { InverterBrand, InverterApiType } from '../../../common/enums';
import { SecretManager } from '../../../common/utils/crypto.utils';
import { UserSettings } from '../../users/entities/user-settings.entity';
import { Alert } from '../../alerts/entities/alert.entity';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../../../common/constants/queue';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInverter(overrides: Partial<Inverter> = {}): Inverter {
  return {
    id: 'inv-uuid-1',
    userId: 'user-uuid-1',
    brand: InverterBrand.VICTRON,
    apiType: InverterApiType.LIVE_API,
    isActive: true,
    isOffline: false,
    installationId: 'site-123',
    encryptedCredentials: 'encrypted-token',
    model: 'Cerbo GX',
    serialNumber: 'SN001',
    ratedCapacityKwh: 10,
    panelCapacityKw: 5,
    lastSyncedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    metrics: [],
    user: undefined as unknown as Inverter['user'],
    ...overrides,
  };
}

function makeMetric(inverterId = 'inv-uuid-1'): NormalisedMetric {
  return {
    inverterId,
    inverterBrand: InverterBrand.SANDBOX,
    recordedAt: new Date().toISOString(),
    inverterStatus: 'normal',
    batterySoc: 80,
    solarPowerKw: 2.5,
    acOutputPowerKw: 2.0,
    gridVoltageV: 230,
    gridFrequencyHz: 50,
    batteryVoltageV: 52.4,
    batteryCurrentA: 10.2,
    batteryTemperatureC: 28,
    batteryTimeToGoMin: 120,
    inverterTemperatureC: 35,
    pvString1PowerKw: null,
    pvString2PowerKw: null,
    energyGeneratedTodayKwh: null,
    totalEnergyGeneratedKwh: null,
    batteryChargedTodayKwh: null,
    batteryDischargedTodayKwh: null,
    gridExportTodayKwh: null,
    gridImportTodayKwh: null,
  };
}

// fast-check arbitrary for NormalisedMetric
const normalisedMetricArb = fc.record<NormalisedMetric>({
  inverterId: fc.uuid(),
  inverterBrand: fc.constant(InverterBrand.SANDBOX),
  recordedAt: fc
    .integer({ min: 0, max: Date.now() })
    .map((ms) => new Date(ms).toISOString()),
  inverterStatus: fc.constantFrom('normal', 'fault', 'standby', 'unknown'),
  batterySoc: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), {
    nil: null,
  }),
  solarPowerKw: fc.option(fc.float({ min: 0, max: 50, noNaN: true }), {
    nil: null,
  }),
  acOutputPowerKw: fc.option(fc.float({ min: 0, max: 50, noNaN: true }), {
    nil: null,
  }),
  gridVoltageV: fc.option(fc.float({ min: 200, max: 260, noNaN: true }), {
    nil: null,
  }),
  gridFrequencyHz: fc.option(fc.float({ min: 49, max: 51, noNaN: true }), {
    nil: null,
  }),
  batteryVoltageV: fc.option(fc.float({ min: 40, max: 60, noNaN: true }), {
    nil: null,
  }),
  batteryCurrentA: fc.option(fc.float({ min: -50, max: 50, noNaN: true }), {
    nil: null,
  }),
  batteryTemperatureC: fc.option(fc.float({ min: 0, max: 60, noNaN: true }), {
    nil: null,
  }),
  batteryTimeToGoMin: fc.option(fc.float({ min: 0, max: 1440, noNaN: true }), {
    nil: null,
  }),
  inverterTemperatureC: fc.option(fc.float({ min: 0, max: 80, noNaN: true }), {
    nil: null,
  }),
  pvString1PowerKw: fc.constant(null),
  pvString2PowerKw: fc.constant(null),
  energyGeneratedTodayKwh: fc.option(
    fc.float({ min: 0, max: 100, noNaN: true }),
    { nil: null },
  ),
  totalEnergyGeneratedKwh: fc.option(
    fc.float({ min: 0, max: 10000, noNaN: true }),
    { nil: null },
  ),
  batteryChargedTodayKwh: fc.constant(null),
  batteryDischargedTodayKwh: fc.constant(null),
  gridExportTodayKwh: fc.constant(null),
  gridImportTodayKwh: fc.constant(null),
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockVictronFetch = jest.fn<
  Promise<NormalisedMetric>,
  [string, string, string]
>();
const mockSandboxFetch = jest.fn<
  Promise<NormalisedMetric>,
  [string, string, string]
>();
const mockGrowattFetch = jest.fn<Promise<NormalisedMetric>, [string, string]>();
const mockSunsynkFetch = jest.fn<
  Promise<NormalisedMetric>,
  [string, string, string]
>();
const mockFindSpecificBrand = jest.fn<Promise<Inverter[]>, [InverterBrand]>();
const mockMarkOnline = jest
  .fn<Promise<void>, [string]>()
  .mockResolvedValue(undefined);
const mockMarkOffline = jest
  .fn<Promise<void>, [string]>()
  .mockResolvedValue(undefined);
const mockRepoCreate = jest.fn();
const mockRepoSave = jest.fn<Promise<InvertersMetrics>, [InvertersMetrics]>();
const mockPublish = jest.fn<Promise<void>, [string, string]>();
const mockSubscribe = jest.fn<Promise<void>, [string, string]>();

// ─── Test setup ──────────────────────────────────────────────────────────────

describe('MetricsPollerService', () => {
  let service: MetricsPollerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(SecretManager, 'decrypt').mockReturnValue('decrypted-token');

    mockMarkOnline.mockResolvedValue(undefined);
    mockMarkOffline.mockResolvedValue(undefined);
    mockRepoCreate.mockImplementation((dto: Partial<InvertersMetrics>) => dto);
    mockRepoSave.mockResolvedValue({} as InvertersMetrics);
    mockPublish.mockResolvedValue(undefined);
    mockSubscribe.mockResolvedValue(undefined);

    // Default: no inverters for any brand
    mockFindSpecificBrand.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsPollerService,
        {
          provide: VictronAdapter,
          useValue: { fetchMetrics: mockVictronFetch },
        },
        {
          provide: SandboxAdapter,
          useValue: { fetchMetrics: mockSandboxFetch },
        },
        {
          provide: GrowattAdapter,
          useValue: { fetchMetrics: mockGrowattFetch },
        },
        {
          provide: SunsynkAdapter,
          useValue: { fetchMetrics: mockSunsynkFetch },
        },
        {
          provide: InverterModelAction,
          useValue: {
            findSpecificBrand: mockFindSpecificBrand,
            markOnline: mockMarkOnline,
            markOffline: mockMarkOffline,
          },
        },
        {
          provide: getRepositoryToken(InvertersMetrics),
          useValue: { create: mockRepoCreate, save: mockRepoSave },
        },
        {
          provide: getRepositoryToken(UserSettings),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(Alert),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((dto: unknown) => dto),
            save: jest.fn().mockResolvedValue({
              id: 'alert-id',
              userId: 'user-id',
              type: 'INVERTER_FAULT',
              severity: 'CRITICAL',
              message: 'offline',
            }),
          },
        },
        {
          provide: getQueueToken(QUEUES.ALERT_DISPATCH),
          useValue: { add: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: MetricsPubSubService,
          useValue: { publish: mockPublish, subscribe: mockSubscribe },
        },
        {
          provide: 'app', // appConfig.KEY — satisfies @Inject(appConfig.KEY) in MetricsPollerService
          useValue: { clientUrl: 'http://localhost:3000' },
        },
      ],
    }).compile();

    service = module.get<MetricsPollerService>(MetricsPollerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── onModuleInit ───────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('loads inverters for all three brands at startup', async () => {
      mockFindSpecificBrand.mockResolvedValue([]);
      await service.onModuleInit();
      expect(mockFindSpecificBrand).toHaveBeenCalledTimes(4);
      expect(mockFindSpecificBrand).toHaveBeenCalledWith(InverterBrand.VICTRON);
      expect(mockFindSpecificBrand).toHaveBeenCalledWith(InverterBrand.GROWATT);
      expect(mockFindSpecificBrand).toHaveBeenCalledWith(InverterBrand.SUNSYNK);
      expect(mockFindSpecificBrand).toHaveBeenCalledWith(InverterBrand.SANDBOX);
    });

    it('starts without error when no inverters are found', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ─── pollVictron ────────────────────────────────────────────────────────────

  describe('pollVictron', () => {
    it('does nothing when no Victron inverters are registered', async () => {
      await service.onModuleInit();
      await service.pollVictron();
      expect(mockVictronFetch).not.toHaveBeenCalled();
    });

    it('polls all registered Victron inverters', async () => {
      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([
              makeInverter({ id: 'inv-1' }),
              makeInverter({ id: 'inv-2' }),
            ])
          : Promise.resolve([]),
      );
      mockVictronFetch
        .mockResolvedValueOnce(makeMetric('inv-1'))
        .mockResolvedValueOnce(makeMetric('inv-2'));

      await service.onModuleInit();
      await service.pollVictron();

      expect(mockVictronFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── pollGrowatt ────────────────────────────────────────────────────────────

  describe('pollGrowatt', () => {
    it('does nothing when no Growatt inverters are registered', async () => {
      await service.onModuleInit();
      await service.pollGrowatt();
      expect(mockGrowattFetch).not.toHaveBeenCalled();
    });

    it('polls all registered Growatt inverters', async () => {
      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.GROWATT
          ? Promise.resolve([
              makeInverter({ id: 'inv-g1', brand: InverterBrand.GROWATT }),
            ])
          : Promise.resolve([]),
      );
      mockGrowattFetch.mockResolvedValue(makeMetric('inv-g1'));

      await service.onModuleInit();
      await service.pollGrowatt();

      expect(mockGrowattFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── pollSunsynk ────────────────────────────────────────────────────────────

  describe('pollSunsynk', () => {
    it('does nothing when no Sunsynk inverters are registered', async () => {
      await service.onModuleInit();
      await service.pollSunsynk();
      expect(mockSunsynkFetch).not.toHaveBeenCalled();
    });

    it('polls all registered Sunsynk inverters', async () => {
      jest
        .spyOn(SecretManager, 'decrypt')
        .mockReturnValue('user@example.com:password123');
      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.SUNSYNK
          ? Promise.resolve([
              makeInverter({ id: 'inv-s1', brand: InverterBrand.SUNSYNK }),
            ])
          : Promise.resolve([]),
      );
      mockSunsynkFetch.mockResolvedValue(makeMetric('inv-s1'));

      await service.onModuleInit();
      await service.pollSunsynk();

      expect(mockSunsynkFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ─── P1: NormalisedMetric persistence round-trip ────────────────────────────

  describe('P1: NormalisedMetric persistence round-trip', () => {
    it('maps all NormalisedMetric fields correctly to InvertersMetrics entity', async () => {
      await fc.assert(
        fc.asyncProperty(normalisedMetricArb, async (metric) => {
          jest.clearAllMocks();
          jest
            .spyOn(SecretManager, 'decrypt')
            .mockReturnValue('decrypted-token');
          mockRepoCreate.mockImplementation(
            (dto: Partial<InvertersMetrics>) => dto,
          );
          mockRepoSave.mockResolvedValue({} as InvertersMetrics);
          mockPublish.mockResolvedValue(undefined);

          mockFindSpecificBrand.mockImplementation((brand) =>
            brand === InverterBrand.VICTRON
              ? Promise.resolve([
                  makeInverter({
                    id: metric.inverterId,
                    installationId: 'site-1',
                  }),
                ])
              : Promise.resolve([]),
          );
          mockVictronFetch.mockResolvedValue(metric);

          await service.onModuleInit();
          await service.pollVictron();

          const calls = mockRepoCreate.mock.calls as [
            Partial<InvertersMetrics>,
          ][];
          const createCall = calls[0]?.[0];
          expect(createCall).toBeDefined();
          expect(createCall?.inverterId).toBe(metric.inverterId);
          expect(createCall?.solarGenKw).toBe(metric.solarPowerKw ?? 0);
          expect(createCall?.batterySocPercent).toBe(metric.batterySoc ?? 0);
          expect(createCall?.loadKw).toBe(metric.acOutputPowerKw ?? 0);
          expect(createCall?.inverterStatus).toBe(metric.inverterStatus);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ─── P4: Adapter failure skips DB write and Redis publish ───────────────────

  describe('P4: Adapter failure skips DB write and Redis publish', () => {
    it('skips save and publish when fetchMetrics throws BrandApiException', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          async (statusCode) => {
            jest.clearAllMocks();
            jest
              .spyOn(SecretManager, 'decrypt')
              .mockReturnValue('decrypted-token');
            mockRepoSave.mockResolvedValue({} as InvertersMetrics);
            mockPublish.mockResolvedValue(undefined);

            mockFindSpecificBrand.mockImplementation((brand) =>
              brand === InverterBrand.VICTRON
                ? Promise.resolve([makeInverter()])
                : Promise.resolve([]),
            );
            mockVictronFetch.mockRejectedValue(
              new BrandApiException(statusCode, 'API error'),
            );

            await service.onModuleInit();
            await service.pollVictron();

            expect(mockRepoSave).not.toHaveBeenCalled();
            expect(mockPublish).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('skips publish when DB save throws', async () => {
      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([makeInverter()])
          : Promise.resolve([]),
      );
      mockVictronFetch.mockResolvedValue(makeMetric());
      mockRepoSave.mockRejectedValue(new Error('DB error'));

      await service.onModuleInit();
      await service.pollVictron();

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  // ─── P11: Poll cycle isolation ──────────────────────────────────────────────

  describe('P11: Poll cycle isolation', () => {
    it('continues polling remaining inverters when one adapter throws', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 0, max: 4 }),
          async (count, failIndexRaw) => {
            jest.clearAllMocks();
            jest
              .spyOn(SecretManager, 'decrypt')
              .mockReturnValue('decrypted-token');
            mockRepoCreate.mockImplementation(
              (dto: Partial<InvertersMetrics>) => dto,
            );
            mockRepoSave.mockResolvedValue({} as InvertersMetrics);
            mockPublish.mockResolvedValue(undefined);

            const failIndex = failIndexRaw % count;
            const inverters = Array.from({ length: count }, (_, i) =>
              makeInverter({ id: `inv-${i}`, installationId: `site-${i}` }),
            );

            mockFindSpecificBrand.mockImplementation((brand) =>
              brand === InverterBrand.VICTRON
                ? Promise.resolve(inverters)
                : Promise.resolve([]),
            );

            mockVictronFetch.mockImplementation(
              (_token: string, _siteId: string, inverterId: string) => {
                if (inverterId === `inv-${failIndex}`) {
                  return Promise.reject(new BrandApiException(500, 'fail'));
                }
                return Promise.resolve(makeMetric(inverterId));
              },
            );

            await service.onModuleInit();
            await service.pollVictron();

            const expectedSuccessCount = count - 1;
            expect(mockRepoSave).toHaveBeenCalledTimes(expectedSuccessCount);
            expect(mockPublish).toHaveBeenCalledTimes(expectedSuccessCount);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ─── P12: Intra-inverter error propagation ──────────────────────────────────

  describe('P12: Intra-inverter error propagation', () => {
    it('skips publish when save fails, but does not affect other inverters', async () => {
      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([
              makeInverter({ id: 'inv-good', installationId: 'site-good' }),
              makeInverter({ id: 'inv-bad', installationId: 'site-bad' }),
            ])
          : Promise.resolve([]),
      );

      mockVictronFetch.mockImplementation(
        (_token: string, _siteId: string, inverterId: string) =>
          Promise.resolve(makeMetric(inverterId)),
      );

      mockRepoCreate.mockImplementation(
        (dto: Partial<InvertersMetrics>) => dto,
      );
      mockRepoSave.mockImplementation((entity: Partial<InvertersMetrics>) => {
        if (entity.inverterId === 'inv-bad') {
          return Promise.reject(new Error('DB error'));
        }
        return Promise.resolve(entity as InvertersMetrics);
      });

      await service.onModuleInit();
      await service.pollVictron();

      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(
        'inverter:inv-good',
        expect.any(String),
      );
    });

    it('does not crash when publish fails after a successful save', async () => {
      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([makeInverter()])
          : Promise.resolve([]),
      );
      mockVictronFetch.mockResolvedValue(makeMetric());
      mockRepoCreate.mockImplementation(
        (dto: Partial<InvertersMetrics>) => dto,
      );
      mockRepoSave.mockResolvedValue({} as InvertersMetrics);
      mockPublish.mockRejectedValue(new Error('Redis error'));

      await service.onModuleInit();
      await expect(service.pollVictron()).resolves.not.toThrow();

      expect(mockRepoSave).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Credential decryption failure ──────────────────────────────────────────

  describe('credential decryption failure', () => {
    it('skips fetch, save, and publish when decrypt throws', async () => {
      jest.spyOn(SecretManager, 'decrypt').mockImplementation(() => {
        throw new Error('bad key');
      });

      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([makeInverter()])
          : Promise.resolve([]),
      );

      await service.onModuleInit();
      await service.pollVictron();

      expect(mockVictronFetch).not.toHaveBeenCalled();
      expect(mockRepoSave).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  // ─── Inverter offline alert ──────────────────────────────────────────────────

  describe('inverter offline alert', () => {
    let alertRepo: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
    let alertQueue: { add: jest.Mock };

    beforeEach(() => {
      // Grab the mocked repos/queue from the module so we can assert on them
      alertRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((dto: unknown) => dto),
        save: jest.fn().mockResolvedValue({
          id: 'alert-id',
          userId: 'user-uuid-1',
          type: 'INVERTER_FAULT',
          severity: 'CRITICAL',
          message: 'offline',
        }),
      };
      alertQueue = { add: jest.fn().mockResolvedValue(undefined) };

      // Re-wire the service's private repos via the module's provider tokens
      // We do this by replacing the mock implementations on the already-injected mocks
      const module = service as unknown as { [key: string]: unknown };
      (module['alertRepo'] as typeof alertRepo) = alertRepo;
      (module['alertQueue'] as typeof alertQueue) = alertQueue;
    });

    it('fires an offline alert after 3 consecutive fetch failures (Victron)', async () => {
      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([makeInverter()])
          : Promise.resolve([]),
      );
      mockVictronFetch.mockRejectedValue(new Error('network error'));

      await service.onModuleInit();

      // First two failures — below threshold, no alert
      await service.pollVictron();
      await service.pollVictron();
      expect(alertRepo.save).not.toHaveBeenCalled();

      // Third failure — threshold reached, alert fires
      await service.pollVictron();
      expect(mockMarkOffline).toHaveBeenCalledWith('inv-uuid-1');
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
      expect(alertQueue.add).toHaveBeenCalledTimes(1);

      const savedAlert = (
        alertRepo.save.mock.calls[0] as unknown[]
      )[0] as Record<string, unknown>;
      expect(savedAlert['type']).toBe('INVERTER_FAULT');
      expect(savedAlert['severity']).toBe('CRITICAL');
      expect(savedAlert['userId']).toBe('user-uuid-1');
    });

    it('suppresses duplicate offline alert within 60-minute cooldown', async () => {
      // Simulate a recent alert already in the DB (within cooldown)
      const recentAlert = {
        id: 'existing-alert',
        userId: 'user-uuid-1',
        type: 'INVERTER_FAULT',
        createdAt: new Date(), // just now — within cooldown
      };
      alertRepo.findOne.mockResolvedValue(recentAlert);

      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([makeInverter()])
          : Promise.resolve([]),
      );
      mockVictronFetch.mockRejectedValue(new Error('network error'));

      await service.onModuleInit();

      // Trigger 3 failures to hit the threshold
      await service.pollVictron();
      await service.pollVictron();
      await service.pollVictron();

      // Alert should be suppressed — no new alert saved
      expect(alertRepo.save).not.toHaveBeenCalled();
      expect(alertQueue.add).not.toHaveBeenCalled();
    });

    it('fires a new offline alert when previous alert is outside the cooldown window', async () => {
      // Simulate an old alert (2 hours ago — outside 60-min cooldown)
      const oldAlert = {
        id: 'old-alert',
        userId: 'user-uuid-1',
        type: 'INVERTER_FAULT',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      };
      alertRepo.findOne.mockResolvedValue(oldAlert);

      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([makeInverter()])
          : Promise.resolve([]),
      );
      mockVictronFetch.mockRejectedValue(new Error('network error'));

      await service.onModuleInit();
      await service.pollVictron();
      await service.pollVictron();
      await service.pollVictron();

      // Old alert is outside cooldown — new alert should fire
      expect(alertRepo.save).toHaveBeenCalledTimes(1);
      expect(alertQueue.add).toHaveBeenCalledTimes(1);
    });

    it('recovers gracefully if alert save throws', async () => {
      alertRepo.save.mockRejectedValue(new Error('DB error'));

      mockFindSpecificBrand.mockImplementation((brand) =>
        brand === InverterBrand.VICTRON
          ? Promise.resolve([makeInverter()])
          : Promise.resolve([]),
      );
      mockVictronFetch.mockRejectedValue(new Error('network error'));

      await service.onModuleInit();
      await service.pollVictron();
      await service.pollVictron();

      // Should not throw even if alert save fails
      await expect(service.pollVictron()).resolves.not.toThrow();
    });
  });
});
