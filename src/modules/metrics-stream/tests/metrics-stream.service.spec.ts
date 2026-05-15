// Mock the config chain before any imports to prevent @t3-oss/env-core ESM parse error
jest.mock('../../../config/env', () => ({}));
jest.mock('../../../config/app.config', () => ({
  appConfig: { KEY: 'app' },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MetricsStreamService } from '../metrics-stream.service';
import { MetricsPubSubService } from '../pubsub/metrics-pubsub.service';
import { InvertersService } from '../../inverters/inverters.service';
import { InvertersMetrics } from '../../inverters-metrics/entities/inverters-metrics.entity';

const mockInverter = {
  id: 'inv-uuid-1',
  userId: 'user-uuid-1',
  installationId: 'site-123',
  isActive: true,
};

const mockMetricsRepo = {
  findOne: jest.fn(),
};

const mockPubSub = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  publish: jest.fn(),
};

const mockInvertersService = {
  findOne: jest.fn(),
};

describe('MetricsStreamService', () => {
  let service: MetricsStreamService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsStreamService,
        { provide: InvertersService, useValue: mockInvertersService },
        { provide: MetricsPubSubService, useValue: mockPubSub },
        {
          provide: getRepositoryToken(InvertersMetrics),
          useValue: mockMetricsRepo,
        },
      ],
    }).compile();

    service = module.get<MetricsStreamService>(MetricsStreamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findInverterForUser', () => {
    it('returns the inverter when the user owns it', async () => {
      mockInvertersService.findOne.mockResolvedValue(mockInverter);

      const result = await service.findInverterForUser(
        'inv-uuid-1',
        'user-uuid-1',
      );

      expect(result).toEqual(mockInverter);
    });

    it('throws ForbiddenException when the user does not own the inverter', async () => {
      mockInvertersService.findOne.mockResolvedValue(mockInverter);

      await expect(
        service.findInverterForUser('inv-uuid-1', 'different-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
