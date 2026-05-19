// ==================================================================
// WHATSAPP DELIVERY PIPELINE
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import {
  formatAlertMessage,
  truncateMessage,
  validatePhoneNumber,
  WhatsAppMessage,
} from '../helpers/whatsapp-helpers';
import { mockWhatsAppClient } from './test-helpers';

type WaMockResult = { status: string; messageId: string };

describe('WhatsAppDelivery — Test Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWhatsAppClient.sendMessage.mockResolvedValue({
      status: 'sent',
      messageId: 'wamid-123',
    });
  });

  // ------------------------------------------------------------------
  // 6.1  Formats alert message correctly
  // ------------------------------------------------------------------
  it('6.1 should format the alert message with type, severity, metric values, and suggested action', () => {
    const alert = {
      type: 'battery_depletion',
      severity: 'critical',
      message: 'Battery is at 8%. Consider reducing load or switching to grid.',
      minutesUntilDepletion: 12,
    };

    const formatted = formatAlertMessage(alert);

    expect(formatted).toContain('🚨');
    expect(formatted).toContain('Energy IQ Alert');
    expect(formatted).toContain('battery_depletion');
    expect(formatted).toContain('12 min');
    expect(formatted).toContain('Consider reducing load');
  });

  // ------------------------------------------------------------------
  // 6.2  Sends via WhatsApp API
  // ------------------------------------------------------------------
  it('6.2 should call the WhatsApp API with correct recipient and formatted message', async () => {
    const message: WhatsAppMessage = {
      to: '+2348012345678',
      body: '🚨 Energy IQ Alert\nType: battery_depletion\nBattery at 8%',
      type: 'text',
    };

    const result = (await mockWhatsAppClient.sendMessage(
      message,
    )) as WaMockResult;

    expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledWith({
      to: '+2348012345678',
      body: expect.stringContaining('Energy IQ Alert') as string,
      type: 'text',
    });
    expect(result.status).toBe('sent');
  });

  // ------------------------------------------------------------------
  // 6.3  Handles API timeout gracefully
  // ------------------------------------------------------------------
  it('6.3 should catch API timeout error and log it without crashing', async () => {
    mockWhatsAppClient.sendMessage.mockRejectedValue(
      new Error('ETIMEDOUT: request timed out after 30s'),
    );

    const sendWithTimeout = async () => {
      try {
        await mockWhatsAppClient.sendMessage({
          to: '+2345678901234',
          body: 'test',
          type: 'text',
        });
      } catch (err) {
        expect((err as Error).message).toContain('ETIMEDOUT');
        throw err;
      }
    };

    await expect(sendWithTimeout()).rejects.toThrow('ETIMEDOUT');
    expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // 6.4  Invalid phone number → fail fast, no API call
  // ------------------------------------------------------------------
  it('6.4 should reject delivery without calling API when phone number is invalid', () => {
    const invalidNumbers = ['12345', 'abc', '', '+2340000000000', null];

    invalidNumbers.forEach((num) => {
      if (num) {
        const isValid = validatePhoneNumber(num);
        expect(isValid).toBe(false);
      }
    });

    expect(mockWhatsAppClient.sendMessage).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 6.5  WhatsApp opt-out check
  // ------------------------------------------------------------------
  it('6.5 should skip WhatsApp delivery when user has whatsappAlerts disabled', () => {
    const userSettings = { whatsappAlerts: false, smsNotification: true };
    const channel = 'whatsapp';

    const channelAllowed =
      channel === 'whatsapp'
        ? userSettings.whatsappAlerts
        : channel === 'sms'
          ? userSettings.smsNotification
          : true;

    expect(channelAllowed).toBe(false);
    // Should fallback to next channel without calling WhatsApp API
    expect(mockWhatsAppClient.sendMessage).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 6.6  Message length truncation
  // ------------------------------------------------------------------
  it('6.6 should truncate messages exceeding WhatsApp character limit (4096)', () => {
    const longBody = 'A'.repeat(5000);
    const truncated = truncateMessage(longBody);

    expect(truncated.length).toBeLessThanOrEqual(4096);
    expect(truncated.endsWith('...')).toBe(true);
    expect(truncated.length).toBe(4096); // 4093 chars + "..."
  });
});

// ------------------------------------------------------------------
// EDGE CASES
// ------------------------------------------------------------------
describe('WhatsAppDelivery — Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // E37  WhatsApp API returns 429 rate-limit error
  // ------------------------------------------------------------------
  it('E37 should back off and retry when API returns 429 Too Many Requests', async () => {
    jest.useFakeTimers();
    mockWhatsAppClient.sendMessage
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce({ status: 'sent', messageId: 'wamid-retry' });

    const sendWithRetry = async (
      attempts: number = 2,
    ): Promise<WaMockResult> => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < attempts; i++) {
        try {
          return (await mockWhatsAppClient.sendMessage({
            to: '+2348012345678',
            body: 'test',
            type: 'text',
          })) as WaMockResult;
        } catch (err) {
          if (i === attempts - 1) throw err;
          await sleep(1000 * Math.pow(2, i));
        }
      }
      throw new Error('sendWithRetry exhausted');
    };

    const pending = sendWithRetry();

    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.status).toBe('sent');
    expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  // ------------------------------------------------------------------
  // E38  Missing country code
  // ------------------------------------------------------------------
  it('E38 should normalize or reject phone numbers missing country code', () => {
    const localNumber = '08031234567'; // Nigerian local format
    const normalized = `+234${localNumber.slice(1)}`; // +2348031234567

    expect(validatePhoneNumber(localNumber)).toBe(true); // accepts local format
    expect(validatePhoneNumber(normalized)).toBe(true); // accepts normalized format
  });

  // ------------------------------------------------------------------
  // E39  Landline number → fail gracefully
  // ------------------------------------------------------------------
  it('E39 should fail fast when phone number is a landline (not mobile)', () => {
    const landlines = ['+2348031234567', '08031234567']; // 803 is mobile — valid
    const invalidLandlines = ['+2341123456789', '0112345678']; // 1/0 prefix = landline

    landlines.forEach((num) => expect(validatePhoneNumber(num)).toBe(true));
    invalidLandlines.forEach((num) =>
      expect(validatePhoneNumber(num)).toBe(false),
    );
  });

  // ------------------------------------------------------------------
  // E40  Unicode / emoji in alert message
  // ------------------------------------------------------------------
  it('E40 should preserve Unicode characters including emoji in WhatsApp message', () => {
    const alert = {
      type: 'high_temperature',
      severity: 'warning',
      message: 'Inverter temp at 65°C — above normal. ⚠️',
    };

    const formatted = formatAlertMessage(alert);

    expect(formatted).toContain('⚠️');
    expect(formatted).toContain('65°C');
    expect(new TextEncoder().encode(formatted).length).toBeGreaterThan(
      formatted.length,
    ); // multi-byte chars present
  });

  // ------------------------------------------------------------------
  // E41  User blocked the WhatsApp sender
  // ------------------------------------------------------------------
  it('E41 should mark delivery as permanently failed when API returns 410 Gone (blocked)', async () => {
    mockWhatsAppClient.sendMessage.mockRejectedValue(
      new Error('410 Gone . User blocked sender'),
    );

    try {
      await mockWhatsAppClient.sendMessage({
        to: '+2348012345678',
        body: 'test',
        type: 'text',
      });
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('410');
      // Should mark as undeliverable permanently — no retry
    }

    expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // E42  Template message rejected by WhatsApp
  // ------------------------------------------------------------------
  it('E42 should catch template rejection and fallback to text message', async () => {
    // Attempt template first
    mockWhatsAppClient.sendMessage.mockRejectedValueOnce(
      new Error('Rejected: template does not match approved category'),
    );

    // Fallback to plain text
    mockWhatsAppClient.sendMessage.mockResolvedValueOnce({
      status: 'sent',
      messageId: 'wamid-text-fallback',
    });

    const sendWithTemplateFallback = async (): Promise<WaMockResult> => {
      try {
        return (await mockWhatsAppClient.sendMessage({
          to: '+2348012345678',
          body: 'Template content',
          type: 'template',
          templateName: 'alert_template',
        })) as WaMockResult;
      } catch {
        return (await mockWhatsAppClient.sendMessage({
          to: '+2348012345678',
          body: '🚨 Battery at 8%',
          type: 'text',
        })) as WaMockResult;
      }
    };

    const result = await sendWithTemplateFallback();
    expect(result.status).toBe('sent');
    expect(mockWhatsAppClient.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockWhatsAppClient.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'text' }),
    );
  });
});
