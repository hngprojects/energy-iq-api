import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../reports.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '../../../common/constants/queue';

const mockQueue = {
  add: jest.fn(),
}

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, {
        provide: getQueueToken(QUEUES.REPORT_DISPATCH),
        useValue: mockQueue
      }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
