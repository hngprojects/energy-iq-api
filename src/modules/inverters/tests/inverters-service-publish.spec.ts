// Mock the config chain before any imports to prevent @t3-oss/env-core ESM parse error
jest.mock('../../../config/env', () => ({}));
jest.mock('../../../config/app.config', () => ({ appConfig: { KEY: 'app' } }));

import { ConflictException } from '@nestjs/common';
import { InvertersService } from '../inverters.service';
import { InverterBrand } from '../../../common/enums';
import {
  INVERTER_CONTROL_CHANNEL,
  InverterControlMessage,
} from '../../../common/constants/queue';
import { Inverter } from '../entities/inverters.entity';

/**
 * Unit tests for InvertersService.connectInverter — specifically the
 * Redis publish behaviour for dynamic poller registration.
 */
describe('InvertersService.connectInverter — publish behaviour', () => {
  let service: InvertersService;

  const mockPubsubService = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  const makeInverter = (
    id: string,
    brand: InverterBrand,
  ): Partial<Inverter> => ({
    id,
    brand,
    userId: 'user-1',
    serialNumber: 'SN-1',
    installationId: 'inst-1',
    isActive: true,
    isOffline: false,
    panelCapacityKw: 10,
    ratedCapacityKwh: 20,
    encryptedCredentials: 'enc',
  });

  /** Safely extract the JSON payload from the first publish call. */
  function getPublishedPayload(): InverterControlMessage {
    const calls = mockPubsubService.publish.mock.calls as [string, string][];
    const raw = calls[0]?.[1] ?? '{}';
    return JSON.parse(raw) as InverterControlMessage;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    service = new InvertersService(
      {} as never, // victronAdapter
      {} as never, // growattAdapter
      {} as never, // sunsynkAdapter
      {} as never, // sandboxAdapter
      {} as never, // inverterModelAction
      mockPubsubService as never,
    );
  });

  it('publishes a "registered" event on INVERTER_CONTROL_CHANNEL when a new inverter is created', async () => {
    const inv = makeInverter('inv-1', InverterBrand.VICTRON);

    jest
      .spyOn(service, 'connectInverterWithMeta')
      .mockResolvedValueOnce({ inverter: inv as Inverter, created: true });

    await service.connectInverter({ brand: InverterBrand.VICTRON }, 'user-1');

    expect(mockPubsubService.publish).toHaveBeenCalledTimes(1);
    expect(mockPubsubService.publish).toHaveBeenCalledWith(
      INVERTER_CONTROL_CHANNEL,
      expect.any(String),
    );

    const payload = getPublishedPayload();
    expect(payload.event).toBe('registered');
    expect(payload.inverterId).toBe('inv-1');
    expect(payload.brand).toBe(InverterBrand.VICTRON);
  });

  it('does NOT publish when connectInverterWithMeta returns created=false (idempotent reconnect)', async () => {
    const inv = makeInverter('inv-1', InverterBrand.SANDBOX);

    jest
      .spyOn(service, 'connectInverterWithMeta')
      .mockResolvedValueOnce({ inverter: inv as Inverter, created: false });

    await service.connectInverter({ brand: InverterBrand.SANDBOX }, 'user-1');

    expect(mockPubsubService.publish).not.toHaveBeenCalled();
  });

  it('still returns the inverter even if the publish call fails', async () => {
    const inv = makeInverter('inv-1', InverterBrand.GROWATT);

    jest
      .spyOn(service, 'connectInverterWithMeta')
      .mockResolvedValueOnce({ inverter: inv as Inverter, created: true });

    mockPubsubService.publish.mockRejectedValueOnce(
      new Error('Redis connection lost'),
    );

    const result = await service.connectInverter(
      { brand: InverterBrand.GROWATT },
      'user-1',
    );

    expect(result.inverter).toBe(inv);
    expect(result.created).toBe(true);
  });

  it('propagates exceptions thrown by connectInverterWithMeta (e.g. ConflictException)', async () => {
    jest
      .spyOn(service, 'connectInverterWithMeta')
      .mockRejectedValueOnce(
        new ConflictException('This VICTRON installation is already connected'),
      );

    await expect(
      service.connectInverter({ brand: InverterBrand.VICTRON }, 'user-1'),
    ).rejects.toThrow(ConflictException);

    expect(mockPubsubService.publish).not.toHaveBeenCalled();
  });

  it('publishes the correct brand for each inverter brand', async () => {
    const brands = [
      InverterBrand.VICTRON,
      InverterBrand.GROWATT,
      InverterBrand.SUNSYNK,
      InverterBrand.SANDBOX,
    ];

    for (const brand of brands) {
      jest.clearAllMocks();
      const inv = makeInverter(`inv-${brand}`, brand);
      jest
        .spyOn(service, 'connectInverterWithMeta')
        .mockResolvedValueOnce({ inverter: inv as Inverter, created: true });

      await service.connectInverter({ brand }, 'user-1');

      const payload = getPublishedPayload();
      expect(payload.brand).toBe(brand);
    }
  });
});
