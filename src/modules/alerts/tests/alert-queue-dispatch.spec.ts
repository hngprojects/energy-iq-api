// ==================================================================
// ALERT DISPATCH PROCESSOR
// Tests for AlertDispatchProcessor in jobs/alert-dispatch.processor.ts
//
// The processor is the BullMQ worker that receives alert jobs and
// delivers them via WhatsApp (primary) or email (fallback).
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { AlertDispatchProcessor } from '../jobs/alert-dispatch.processor';
import {
  ALERT_DISPATCH_JOB,
  ALERT_DEFERRED_DELIVERY_JOB,
} from '../jobs/alert-dispatch.jobs';
import { ProcessingStatus } from '../../../common/constants/processing-status';
import { AlertSeverity, AlertType } from '../../../common/enums';

// ------------------------------------------------------------------
// Typed helpers
// ------------------------------------------------------------------
interface AlertSaveArg {
  deliveryChannel?: string | null;
  deliveryStatus?: string;
  deliveryProcessingStatus?: string;
}

interface MockJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
}

function makeJob(name: string, data: Record<string, unknown>): MockJob {
  return { id: 'job-1', name, data };
}

function findSaveCall(
  calls: unknown[][],
  predicate: (arg: AlertSaveArg) => boolean,
): AlertSaveArg | undefined {
  const found = calls.find((call) => predicate(call[0] as AlertSaveArg));
  return found ? (found[0] as AlertSaveArg) : undefined;
}

// ------------------------------------------------------------------
// Mock factory
// ------------------------------------------------------------------
function makeProcessor() {
  const alertRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  };
  const userSettingsRepo = {
    findOne: jest.fn(),
  };
  const whatsappService = {
    sendText: jest.fn(),
  };
  const emailService = {
    sendAlert: jest.fn(),
  };

  const processor = new AlertDispatchProcessor(
    alertRepo as never,
    userRepo as never,
    userSettingsRepo as never,
    whatsappService as never,
    emailService as never,
  );

  return {
    processor,
    alertRepo,
    userRepo,
    userSettingsRepo,
    whatsappService,
    emailService,
  };
}

function makeAlert(
  overrides: Partial<AlertSaveArg & Record<string, unknown>> = {},
) {
  return {
    id: 'alert-uuid-1',
    userId: 'user-uuid-1',
    type: AlertType.BATTERY_PERCENTAGE,
    severity: AlertSeverity.CRITICAL,
    message: 'Battery depletion imminent',
    deliveryProcessingStatus: ProcessingStatus.pending,
    deliveryStatus: 'pending',
    deliveryChannel: null,
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-1',
    email: 'user@example.com',
    phoneNumber: '+2348031234567',
    firstName: 'Test',
    ...overrides,
  };
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    whatsappAlerts: true,
    emailAlerts: true,
    ...overrides,
  };
}

// ------------------------------------------------------------------
// TESTS  (6.1 – 6.9)   —   Processor Core Logic
// ------------------------------------------------------------------
describe('AlertDispatchProcessor — Test Cases', () => {
  it('6.1 should throw when alert is not found in DB', async () => {
    const { processor, alertRepo } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(null);

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'missing-alert',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await expect(processor.process(job as never)).rejects.toThrow(
      'Alert not found',
    );
  });

  it('6.2 should throw when user is not found in DB', async () => {
    const { processor, alertRepo, userRepo } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(null);

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'missing-user',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await expect(processor.process(job as never)).rejects.toThrow(
      'User not found',
    );
  });

  it('6.3 should deliver via WhatsApp when whatsappAlerts=true and phoneNumber is set', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
      emailService,
    } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    alertRepo.save.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(
      makeUser({ phoneNumber: '+2348031234567' }),
    );
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: true }),
    );
    whatsappService.sendText.mockResolvedValue('wamid-123');

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await processor.process(job as never);

    expect(whatsappService.sendText).toHaveBeenCalledWith(
      '+2348031234567',
      expect.any(String),
    );
    expect(emailService.sendAlert).not.toHaveBeenCalled();

    const saved = findSaveCall(
      alertRepo.save.mock.calls as unknown[][],
      (a) => a.deliveryChannel === 'whatsapp',
    );
    expect(saved).toBeDefined();
    expect(saved!.deliveryStatus).toBe('delivered');
    expect(saved!.deliveryProcessingStatus).toBe(ProcessingStatus.successful);
  });

  it('6.4 should skip WhatsApp and use email when whatsappAlerts=false', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
      emailService,
    } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    alertRepo.save.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(makeUser());
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: false, emailAlerts: true }),
    );
    emailService.sendAlert.mockResolvedValue(undefined);

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await processor.process(job as never);

    expect(whatsappService.sendText).not.toHaveBeenCalled();
    expect(emailService.sendAlert).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String),
    );
  });

  it('6.5 should fall back to email when WhatsApp throws', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
      emailService,
    } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    alertRepo.save.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(
      makeUser({ phoneNumber: '+2348031234567' }),
    );
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: true, emailAlerts: true }),
    );
    whatsappService.sendText.mockRejectedValue(new Error('WhatsApp API error'));
    emailService.sendAlert.mockResolvedValue(undefined);

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await processor.process(job as never);

    expect(whatsappService.sendText).toHaveBeenCalledTimes(1);
    expect(emailService.sendAlert).toHaveBeenCalledTimes(1);

    const saved = findSaveCall(
      alertRepo.save.mock.calls as unknown[][],
      (a) => a.deliveryChannel === 'email',
    );
    expect(saved).toBeDefined();
    expect(saved!.deliveryStatus).toBe('delivered');
  });

  it('6.6 should mark alert as failed and throw when all channels fail', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
      emailService,
    } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    alertRepo.save.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(
      makeUser({ phoneNumber: '+2348031234567' }),
    );
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: true, emailAlerts: true }),
    );
    whatsappService.sendText.mockRejectedValue(new Error('WhatsApp down'));
    emailService.sendAlert.mockRejectedValue(new Error('Email down'));

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await expect(processor.process(job as never)).rejects.toThrow(
      'Delivery failed',
    );

    const saved = findSaveCall(
      alertRepo.save.mock.calls as unknown[][],
      (a) => a.deliveryStatus === 'failed',
    );
    expect(saved).toBeDefined();
    expect(saved!.deliveryProcessingStatus).toBe(ProcessingStatus.failed);
  });

  it('6.7 should transition deliveryProcessingStatus: pending → processing → successful', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
    } = makeProcessor();
    const alert = makeAlert({
      deliveryProcessingStatus: ProcessingStatus.pending,
    });
    alertRepo.findOne.mockResolvedValue(alert);
    const statusHistory: string[] = [];
    alertRepo.save.mockImplementation((a: AlertSaveArg) => {
      if (a.deliveryProcessingStatus)
        statusHistory.push(a.deliveryProcessingStatus);
      return Promise.resolve(a);
    });
    userRepo.findOne.mockResolvedValue(
      makeUser({ phoneNumber: '+2348031234567' }),
    );
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: true }),
    );
    whatsappService.sendText.mockResolvedValue('wamid-123');

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await processor.process(job as never);

    expect(statusHistory).toContain(ProcessingStatus.processing);
    expect(statusHistory).toContain(ProcessingStatus.successful);
    expect(statusHistory.indexOf(ProcessingStatus.processing)).toBeLessThan(
      statusHistory.indexOf(ProcessingStatus.successful),
    );
  });

  it('6.8 should handle deferred delivery by re-dispatching the alert', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
    } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    alertRepo.save.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(
      makeUser({ phoneNumber: '+2348031234567' }),
    );
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: true }),
    );
    whatsappService.sendText.mockResolvedValue('wamid-123');

    const job = makeJob(ALERT_DEFERRED_DELIVERY_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      scheduledFor: new Date().toISOString(),
    });

    await processor.process(job as never);

    expect(whatsappService.sendText).toHaveBeenCalledTimes(1);
  });

  it('6.9 should throw for unknown job names', async () => {
    const { processor } = makeProcessor();

    const job = makeJob('unknown.job.type', { alertId: 'x', userId: 'y' });

    await expect(processor.process(job as never)).rejects.toThrow(
      'Unknown alert dispatch job type',
    );
  });
});

// ------------------------------------------------------------------
// EDGE CASES  (E43, E44)
// ------------------------------------------------------------------
describe('AlertDispatchProcessor — Edge Cases', () => {
  it('E43 should mark alert as failed after all channels fail without infinite loop', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
      emailService,
    } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    alertRepo.save.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(
      makeUser({ phoneNumber: '+2348031234567' }),
    );
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: true, emailAlerts: true }),
    );
    whatsappService.sendText.mockRejectedValue(new Error('error'));
    emailService.sendAlert.mockRejectedValue(new Error('error'));

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await expect(processor.process(job as never)).rejects.toThrow();

    expect(whatsappService.sendText).toHaveBeenCalledTimes(1);
    expect(emailService.sendAlert).toHaveBeenCalledTimes(1);
  });

  it('E44 should skip WhatsApp when phoneNumber is null and fall back to email', async () => {
    const {
      processor,
      alertRepo,
      userRepo,
      userSettingsRepo,
      whatsappService,
      emailService,
    } = makeProcessor();
    alertRepo.findOne.mockResolvedValue(makeAlert());
    alertRepo.save.mockResolvedValue(makeAlert());
    userRepo.findOne.mockResolvedValue(makeUser({ phoneNumber: null }));
    userSettingsRepo.findOne.mockResolvedValue(
      makeSettings({ whatsappAlerts: true, emailAlerts: true }),
    );
    emailService.sendAlert.mockResolvedValue(undefined);

    const job = makeJob(ALERT_DISPATCH_JOB, {
      alertId: 'alert-uuid-1',
      userId: 'user-uuid-1',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
      message: '',
      channel: 'whatsapp',
    });

    await processor.process(job as never);

    expect(whatsappService.sendText).not.toHaveBeenCalled();
    expect(emailService.sendAlert).toHaveBeenCalledTimes(1);
  });
});
