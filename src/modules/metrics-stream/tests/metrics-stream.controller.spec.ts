// Mock the config chain before any imports to prevent @t3-oss/env-core ESM parse error
jest.mock('../../../config/env', () => ({}));
jest.mock('../../../config/app.config', () => ({
  appConfig: { KEY: 'app' },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { MetricsStreamController } from '../metrics-stream.controller';
import { MetricsStreamService } from '../metrics-stream.service';

describe('MetricsStreamController', () => {
  let controller: MetricsStreamController;

  const mockService = {
    findInverterForUser: jest.fn(),
    streamMetrics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsStreamController],
      providers: [{ provide: MetricsStreamService, useValue: mockService }],
    }).compile();

    controller = module.get<MetricsStreamController>(MetricsStreamController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('streamMetrics', () => {
    it('calls findInverterForUser then streamMetrics with correct args', async () => {
      const inverterId = 'inv-uuid-1';
      const currentUser = { sub: 'user-uuid-1', email: 'user@example.com' };
      const req = {} as unknown;
      const res = {} as unknown;

      mockService.findInverterForUser.mockResolvedValue({});
      mockService.streamMetrics.mockResolvedValue(undefined);

      await controller.streamMetrics(inverterId, currentUser, req, res);

      expect(mockService.findInverterForUser).toHaveBeenCalledWith(
        inverterId,
        currentUser.sub,
      );
      expect(mockService.streamMetrics).toHaveBeenCalledWith(
        inverterId,
        req,
        res,
      );
    });
  });
});
