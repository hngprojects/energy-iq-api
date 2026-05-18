// ==================================================================
// SHARED TEST HELPERS — All mocks consolidated here
// ==================================================================

import { Queue, Job } from 'bullmq';
import { Inverter } from '../../inverters/entities/inverters.entity';

// ------------------------------------------------------------------
// Repository Mocks
// ------------------------------------------------------------------
export const mockAlertRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

export const mockMetricsRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
};

export const mockInverterRepo = {
  find: jest.fn(),
};

export const mockUserSettingsRepo = {
  findOne: jest.fn(),
};

// ------------------------------------------------------------------
// WhatsApp API Client Mock
// ------------------------------------------------------------------
export const mockWhatsAppClient = {
  sendMessage: jest.fn(),
};

// ------------------------------------------------------------------
// BullMQ Queue Mock
// ------------------------------------------------------------------
export const mockAlertQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  getJobs: jest.fn(),
  close: jest.fn(),
  isPaused: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  on: jest.fn(),
};

// ------------------------------------------------------------------
// Channel Services Mock (for fallback tests)
// ------------------------------------------------------------------
export const channelServices = {
  whatsapp: { send: jest.fn() },
  email: { send: jest.fn() },
  sms: { send: jest.fn() },
};

// ------------------------------------------------------------------
// Common Types / Interfaces
// ------------------------------------------------------------------
export interface MockUserSettings {
  userId: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  bypassCritical?: boolean;
  depletionThreshold?: number;
  alertCooldownMinutes?: number;
  whatsappAlerts?: boolean;
  emailAlerts?: boolean;
  smsNotification?: boolean;
  timezone?: string;
}

export interface CronServiceMock {
  evaluateInverters: jest.Mock<Promise<void>, []>;
  shouldFireAlert: jest.Mock<
    { minutesUntilDepletion: number; isCharging: boolean; severity: string } | null,
    [Record<string, unknown>]
  >;
  createAlert: jest.Mock;
}

// ------------------------------------------------------------------
// Helper: Reset all mocks at once
// ------------------------------------------------------------------
export function resetAllMocks(): void {
  jest.clearAllMocks();

  // Repos
  mockAlertRepo.findOne.mockReset();
  mockAlertRepo.find.mockReset();
  mockAlertRepo.save.mockReset();
  mockAlertRepo.create.mockReset();
  mockMetricsRepo.findOne.mockReset();
  mockMetricsRepo.find.mockReset();
  mockInverterRepo.find.mockReset();
  mockUserSettingsRepo.findOne.mockReset();

  // Clients
  mockWhatsAppClient.sendMessage.mockReset();

  // Queue
  mockAlertQueue.add.mockReset();
  mockAlertQueue.close.mockReset();
  mockAlertQueue.isPaused.mockReset();
  mockAlertQueue.pause.mockReset();
  mockAlertQueue.resume.mockReset();
  
  // Channel services
  channelServices.whatsapp.send.mockReset();
  channelServices.email.send.mockReset();
  channelServices.sms.send.mockReset();
}