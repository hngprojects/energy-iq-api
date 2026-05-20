import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailService } from '../email.service';
import { QUEUES } from '../../../common/constants/queue';

const mockQueue = {
  add: jest.fn(),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: getQueueToken(QUEUES.EMAIL),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enqueue a welcome email', async () => {
    await service.sendWelcome(
      'user@example.com',
      'John',
      'https://app.example.com',
    );
    expect(mockQueue.add).toHaveBeenCalledWith('welcome', {
      to: 'user@example.com',
      firstName: 'John',
      clientUrl: 'https://app.example.com',
    });
  });

  it('should enqueue a password reset email', async () => {
    await service.sendPasswordReset(
      'user@example.com',
      'https://reset.link',
      'John',
    );
    expect(mockQueue.add).toHaveBeenCalledWith('password-reset', {
      to: 'user@example.com',
      resetLink: 'https://reset.link',
      firstName: 'John',
    });
  });

  it('should enqueue a verify email', async () => {
    await service.sendVerifyEmail(
      'user@example.com',
      'John',
      '123456',
      'https://app.example.com',
    );
    expect(mockQueue.add).toHaveBeenCalledWith('verify-email', {
      to: 'user@example.com',
      firstName: 'John',
      verifyCode: '123456',
      clientUrl: 'https://app.example.com',
    });
  });

  it('should enqueue a password update email', async () => {
    await service.sendPasswordUpdate(
      'user@example.com',
      'https://app.example.com',
      'John',
    );
    expect(mockQueue.add).toHaveBeenCalledWith('password-update', {
      to: 'user@example.com',
      clientUrl: 'https://app.example.com',
      firstName: 'John',
    });
  });

  it('should enqueue a link expire email', async () => {
    await service.sendLinkExpire(
      'user@example.com',
      'https://reset.link',
      'John',
    );
    expect(mockQueue.add).toHaveBeenCalledWith('link-expire', {
      to: 'user@example.com',
      requestUrl: 'https://reset.link',
      firstName: 'John',
    });
  });
});
