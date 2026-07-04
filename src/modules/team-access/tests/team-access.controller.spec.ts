import { Test, TestingModule } from '@nestjs/testing';
import { TeamAccessController } from '../team-access.controller';

describe('TeamAccessController', () => {
  let controller: TeamAccessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamAccessController],
    }).compile();

    controller = module.get<TeamAccessController>(TeamAccessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
