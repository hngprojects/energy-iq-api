import { Test, TestingModule } from '@nestjs/testing';
import { TeamAccessService } from '../team-access.service';

describe('TeamAccessService', () => {
  let service: TeamAccessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeamAccessService],
    }).compile();

    service = module.get<TeamAccessService>(TeamAccessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
