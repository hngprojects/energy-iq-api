// ==================================================================
// DELIVERY FALLBACK SERVICE
// Tests for fallback.service.ts — deliverWithFallback
//
// The function iterates a prioritized channel chain, awaits each
// send(), skips disabled channels, and returns a DeliveryResult
// with status, channelUsed, and a full audit trail.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { AlertDelivery, deliverWithFallback } from '../fallback.service';

// ------------------------------------------------------------------
// Local channel service mocks — fresh per test via beforeEach
// ------------------------------------------------------------------
const whatsappSend = jest.fn<
  Promise<void>,
  [{ to: string; message: string }]
>();
const emailSend = jest.fn<Promise<void>, [{ to: string; message: string }]>();
const smsSend = jest.fn<Promise<void>, [{ to: string; message: string }]>();

const channelServices = {
  whatsapp: { send: whatsappSend },
  email: { send: emailSend },
  sms: { send: smsSend },
};

function makeDelivery(overrides: Partial<AlertDelivery> = {}): AlertDelivery {
  return {
    alertId: 'alert-1',
    userId: 'user-1',
    message: 'Battery critical',
    channels: ['whatsapp', 'email', 'sms'],
    userSettings: {
      whatsappAlerts: true,
      emailAlerts: true,
      smsNotification: true,
    },
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Section 8: Delivery Fallback — Test Cases
// ------------------------------------------------------------------
describe('DeliveryFallback — Test Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all channels succeed
    whatsappSend.mockResolvedValue(undefined);
    emailSend.mockResolvedValue(undefined);
    smsSend.mockResolvedValue(undefined);
  });

  // ------------------------------------------------------------------
  // 8.1  WhatsApp succeeds → delivered via whatsapp
  // ------------------------------------------------------------------
  it('8.1 should return delivered via whatsapp when WhatsApp send succeeds', async () => {
    const result = await deliverWithFallback(makeDelivery(), channelServices);

    expect(result.status).toBe('delivered');
    expect(result.channelUsed).toBe('whatsapp');
    expect(result.audit).toEqual(['whatsapp: delivered']);
    expect(whatsappSend).toHaveBeenCalledTimes(1);
    expect(emailSend).not.toHaveBeenCalled();
    expect(smsSend).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 8.2  WhatsApp fails → email succeeds
  // ------------------------------------------------------------------
  it('8.2 should fall back to email when WhatsApp send rejects', async () => {
    whatsappSend.mockRejectedValue(new Error('WhatsApp API error'));

    const result = await deliverWithFallback(makeDelivery(), channelServices);

    expect(result.status).toBe('delivered');
    expect(result.channelUsed).toBe('email');
    expect(result.audit).toEqual([
      'whatsapp: failed - WhatsApp API error',
      'email: delivered',
    ]);
    expect(whatsappSend).toHaveBeenCalledTimes(1);
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(smsSend).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 8.3  Both fail → status = 'failed', channelUsed = null
  // ------------------------------------------------------------------
  it('8.3 should return failed with null channelUsed when all channels reject', async () => {
    whatsappSend.mockRejectedValue(new Error('WA down'));
    emailSend.mockRejectedValue(new Error('Email down'));
    smsSend.mockRejectedValue(new Error('SMS down'));

    const result = await deliverWithFallback(makeDelivery(), channelServices);

    expect(result.status).toBe('failed');
    expect(result.channelUsed).toBeNull();
    expect(result.audit).toHaveLength(3);
    result.audit.forEach((entry) => expect(entry).toContain('failed'));
  });

  // ------------------------------------------------------------------
  // 8.4  Disabled channel is skipped — not called, audit says skipped
  // ------------------------------------------------------------------
  it('8.4 should skip whatsapp and go straight to email when whatsappAlerts=false', async () => {
    const delivery = makeDelivery({
      channels: ['whatsapp', 'email'],
      userSettings: {
        whatsappAlerts: false,
        emailAlerts: true,
        smsNotification: false,
      },
    });

    const result = await deliverWithFallback(delivery, channelServices);

    expect(whatsappSend).not.toHaveBeenCalled();
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('delivered');
    expect(result.channelUsed).toBe('email');
    expect(result.audit).toContain('whatsapp: skipped (user disabled)');
  });

  // ------------------------------------------------------------------
  // 8.5  Each channel attempted exactly once — no retry on failure
  // ------------------------------------------------------------------
  it('8.5 should attempt each failing channel exactly once without retrying', async () => {
    whatsappSend.mockRejectedValue(new Error('error'));

    const delivery = makeDelivery({
      channels: ['whatsapp'],
      userSettings: {
        whatsappAlerts: true,
        emailAlerts: false,
        smsNotification: false,
      },
    });

    const result = await deliverWithFallback(delivery, channelServices);

    expect(result.status).toBe('failed');
    expect(whatsappSend).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // 8.6  Audit trail populated for both failed and succeeded attempts
  // ------------------------------------------------------------------
  it('8.6 should populate audit trail with entries for every attempted channel', async () => {
    whatsappSend.mockRejectedValue(new Error('WhatsApp error'));

    const delivery = makeDelivery({
      channels: ['whatsapp', 'email'],
      userSettings: {
        whatsappAlerts: true,
        emailAlerts: true,
        smsNotification: false,
      },
    });

    const result = await deliverWithFallback(delivery, channelServices);

    expect(result.audit).toHaveLength(2);
    expect(result.audit[0]).toBe('whatsapp: failed - WhatsApp error');
    expect(result.audit[1]).toBe('email: delivered');
    expect(result.status).toBe('delivered');
  });
});

// ------------------------------------------------------------------
// Section 8: Delivery Fallback — Edge Cases
// ------------------------------------------------------------------
describe('DeliveryFallback — Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    whatsappSend.mockRejectedValue(new Error('err'));
    emailSend.mockRejectedValue(new Error('err'));
    smsSend.mockRejectedValue(new Error('err'));
  });

  // ------------------------------------------------------------------
  // E43  All channels fail — stops after exhausting chain, no infinite loop
  // ------------------------------------------------------------------
  it('E43 should mark alert as failed and stop after exhausting all channels', async () => {
    const result = await deliverWithFallback(makeDelivery(), channelServices);

    expect(result.status).toBe('failed');
    expect(whatsappSend).toHaveBeenCalledTimes(1);
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(smsSend).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // E45  Same transient error on all channels — still stops cleanly
  // ------------------------------------------------------------------
  it('E45 should not cascade infinitely when all channels fail with the same error', async () => {
    const delivery = makeDelivery({
      channels: ['whatsapp', 'email'],
      userSettings: {
        whatsappAlerts: true,
        emailAlerts: true,
        smsNotification: false,
      },
    });

    const result = await deliverWithFallback(delivery, channelServices);

    expect(result.status).toBe('failed');
    expect(whatsappSend).toHaveBeenCalledTimes(1);
    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(smsSend).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // E46  Partial success — WhatsApp fails, email succeeds
  //      status = 'delivered', audit has 2 entries
  // ------------------------------------------------------------------
  it('E46 should return delivered with 2-entry audit when WhatsApp fails and email succeeds', async () => {
    emailSend.mockResolvedValue(undefined);

    const delivery = makeDelivery({
      channels: ['whatsapp', 'email', 'sms'],
      userSettings: {
        whatsappAlerts: true,
        emailAlerts: true,
        smsNotification: true,
      },
    });

    const result = await deliverWithFallback(delivery, channelServices);

    expect(result.status).toBe('delivered');
    expect(result.channelUsed).toBe('email');
    expect(result.audit).toHaveLength(2);
    expect(result.audit[0]).toContain('whatsapp: failed');
    expect(result.audit[1]).toBe('email: delivered');
    // SMS never attempted because email succeeded
    expect(smsSend).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // Extra: all channels disabled → partial_success (no lastError set)
  // ------------------------------------------------------------------
  it('should return partial_success when all channels are skipped due to user preferences', async () => {
    const delivery = makeDelivery({
      channels: ['whatsapp', 'email', 'sms'],
      userSettings: {
        whatsappAlerts: false,
        emailAlerts: false,
        smsNotification: false,
      },
    });

    const result = await deliverWithFallback(delivery, channelServices);

    expect(result.status).toBe('partial_success');
    expect(result.channelUsed).toBeNull();
    expect(whatsappSend).not.toHaveBeenCalled();
    expect(emailSend).not.toHaveBeenCalled();
    expect(smsSend).not.toHaveBeenCalled();
    expect(result.audit).toHaveLength(3);
    result.audit.forEach((entry) => expect(entry).toContain('skipped'));
  });

  // ------------------------------------------------------------------
  // Extra: send receives correct to and message arguments
  // ------------------------------------------------------------------
  it('should pass userId as "to" and the message string to the channel send function', async () => {
    whatsappSend.mockResolvedValue(undefined);

    const delivery = makeDelivery({
      userId: 'user-42',
      message: 'Battery at 5%',
      channels: ['whatsapp'],
      userSettings: {
        whatsappAlerts: true,
        emailAlerts: false,
        smsNotification: false,
      },
    });

    await deliverWithFallback(delivery, channelServices);

    expect(whatsappSend).toHaveBeenCalledWith({
      to: 'user-42',
      message: 'Battery at 5%',
    });
  });
});
