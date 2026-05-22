// Mock the config chain before any imports to prevent @t3-oss/env-core ESM parse error
jest.mock('../../../config/env', () => ({}));
jest.mock('../../../config/app.config', () => ({ appConfig: { KEY: 'app' } }));

import { MetricsPollerService } from '../poller/metrics-poller.service';
import { InverterBrand } from '../../../common/enums';
import { Inverter } from '../../inverters/entities/inverters.entity';

/**
 * Unit tests for MetricsPollerService dynamic registration.
 * All I/O dependencies are mocked — no Redis, no DB, no adapters needed.
 *
 * Private fields are accessed via a typed helper to satisfy the linter.
 */
describe('MetricsPollerService — dynamic registration', () => {
  let poller: MetricsPollerService;

  // Typed accessor for private state — avoids no-unsafe-member-access
  function state(p: MetricsPollerService): {
    victronInverters: Inverter[];
    growattInverters: Inverter[];
    sunsynkInverters: Inverter[];
    sandboxInverters: Inverter[];
    failureCounts: Map<string, number>;
  } {
    return p as unknown as {
      victronInverters: Inverter[];
      growattInverters: Inverter[];
      sunsynkInverters: Inverter[];
      sandboxInverters: Inverter[];
      failureCounts: Map<string, number>;
    };
  }

  const mockInverterModelAction = {
    get: jest.fn(),
    findSpecificBrand: jest.fn().mockResolvedValue([]),
    markOnline: jest.fn(),
    markOffline: jest.fn(),
  };

  const mockPubSubService = {
    subscribe: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const makeInverter = (
    id: string,
    brand: InverterBrand,
  ): Partial<Inverter> => ({
    id,
    brand,
    encryptedCredentials: 'enc',
    installationId: 'inst-1',
    serialNumber: 'SN-1',
    isOffline: false,
    isActive: true,
    panelCapacityKw: 10,
    ratedCapacityKwh: 20,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    poller = new MetricsPollerService(
      {} as never, // victronAdapter
      {} as never, // growattAdapter
      {} as never, // sunsynkAdapter
      {} as never, // sandboxAdapter
      mockInverterModelAction as never,
      {} as never, // metricsRepo
      mockPubSubService as never,
    );
  });

  // ── handleInverterRegistered ──────────────────────────────────────────────

  describe('handleInverterRegistered', () => {
    it('fetches the inverter from DB and adds it to the correct brand array', async () => {
      const inv = makeInverter('inv-1', InverterBrand.VICTRON);
      mockInverterModelAction.get.mockResolvedValueOnce(inv);

      await poller.handleInverterRegistered('inv-1');

      expect(mockInverterModelAction.get).toHaveBeenCalledWith({
        identifierOptions: { id: 'inv-1' },
      });
      expect(state(poller).victronInverters).toContain(inv);
    });

    it('adds a Growatt inverter to the growatt array', async () => {
      const inv = makeInverter('inv-2', InverterBrand.GROWATT);
      mockInverterModelAction.get.mockResolvedValueOnce(inv);

      await poller.handleInverterRegistered('inv-2');

      expect(state(poller).growattInverters).toContain(inv);
      expect(state(poller).victronInverters).toHaveLength(0);
    });

    it('adds a Sandbox inverter to the sandbox array', async () => {
      const inv = makeInverter('inv-3', InverterBrand.SANDBOX);
      mockInverterModelAction.get.mockResolvedValueOnce(inv);

      await poller.handleInverterRegistered('inv-3');

      expect(state(poller).sandboxInverters).toContain(inv);
    });

    it('does not add a duplicate if the inverter is already tracked', async () => {
      const inv = makeInverter('inv-1', InverterBrand.VICTRON);
      mockInverterModelAction.get.mockResolvedValue(inv);

      await poller.handleInverterRegistered('inv-1');
      await poller.handleInverterRegistered('inv-1'); // second call

      expect(state(poller).victronInverters).toHaveLength(1);
    });

    it('logs a warning and does nothing when the inverter is not found in DB', async () => {
      mockInverterModelAction.get.mockResolvedValueOnce(null);

      await poller.handleInverterRegistered('unknown-id');

      expect(state(poller).victronInverters).toHaveLength(0);
      expect(state(poller).growattInverters).toHaveLength(0);
    });
  });

  // ── handleInverterDeregistered ────────────────────────────────────────────

  describe('handleInverterDeregistered', () => {
    it('removes the inverter from the correct brand array', async () => {
      const inv = makeInverter('inv-1', InverterBrand.VICTRON);
      mockInverterModelAction.get.mockResolvedValueOnce(inv);
      await poller.handleInverterRegistered('inv-1');
      expect(state(poller).victronInverters).toHaveLength(1);

      poller.handleInverterDeregistered('inv-1');

      expect(state(poller).victronInverters).toHaveLength(0);
    });

    it('clears the failure count for the deregistered inverter', async () => {
      const inv = makeInverter('inv-1', InverterBrand.VICTRON);
      mockInverterModelAction.get.mockResolvedValueOnce(inv);
      await poller.handleInverterRegistered('inv-1');

      state(poller).failureCounts.set('inv-1', 2);
      expect(state(poller).failureCounts.has('inv-1')).toBe(true);

      poller.handleInverterDeregistered('inv-1');

      expect(state(poller).failureCounts.has('inv-1')).toBe(false);
    });

    it('does nothing gracefully when the inverter is not tracked', () => {
      expect(() => {
        poller.handleInverterDeregistered('not-tracked');
      }).not.toThrow();
    });

    it('only removes the matching inverter, leaving others intact', async () => {
      const inv1 = makeInverter('inv-1', InverterBrand.VICTRON);
      const inv2 = makeInverter('inv-2', InverterBrand.VICTRON);
      mockInverterModelAction.get
        .mockResolvedValueOnce(inv1)
        .mockResolvedValueOnce(inv2);

      await poller.handleInverterRegistered('inv-1');
      await poller.handleInverterRegistered('inv-2');
      expect(state(poller).victronInverters).toHaveLength(2);

      poller.handleInverterDeregistered('inv-1');

      expect(state(poller).victronInverters).toHaveLength(1);
      expect(state(poller).victronInverters[0].id).toBe('inv-2');
    });
  });
});
