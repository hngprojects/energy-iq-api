// ==================================================================
// WHATSAPP HELPERS — Pure Functions
// Tests for helpers/whatsapp-helpers.ts
//
// Covers: formatAlertMessage, truncateMessage, validatePhoneNumber
// No external dependencies — all tests call the functions directly.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import {
  formatAlertMessage,
  truncateMessage,
  validatePhoneNumber,
} from '../helpers/whatsapp-helpers';

// ------------------------------------------------------------------
// Section 7: WhatsApp Helpers — Test Cases
// ------------------------------------------------------------------
describe('WhatsAppHelpers — Test Cases', () => {
  // ------------------------------------------------------------------
  // 7.1  formatAlertMessage includes severity icon for critical
  // ------------------------------------------------------------------
  it('7.1 should include 🚨 icon when severity is critical', () => {
    const alert = {
      type: 'battery_depletion',
      severity: 'critical',
      message: 'Battery is critically low.',
    };

    const result = formatAlertMessage(alert);

    expect(result).toContain('🚨');
  });

  // ------------------------------------------------------------------
  // 7.2  formatAlertMessage includes type and message text
  // ------------------------------------------------------------------
  it('7.2 should include alert type and message body in the formatted output', () => {
    const alert = {
      type: 'high_temperature',
      severity: 'warning',
      message: 'Inverter temperature is above normal.',
    };

    const result = formatAlertMessage(alert);

    expect(result).toContain('high_temperature');
    expect(result).toContain('Inverter temperature is above normal.');
  });

  // ------------------------------------------------------------------
  // 7.3  formatAlertMessage includes depletion time when provided
  // ------------------------------------------------------------------
  it('7.3 should include depletion time line when minutesUntilDepletion is provided', () => {
    const alert = {
      type: 'battery_depletion',
      severity: 'critical',
      message: 'Battery depletion imminent.',
      minutesUntilDepletion: 12,
    };

    const result = formatAlertMessage(alert);

    expect(result).toContain('12 min');
    expect(result).toContain('⏱');
  });

  // ------------------------------------------------------------------
  // 7.4  formatAlertMessage omits depletion line when not provided
  // ------------------------------------------------------------------
  it('7.4 should omit the depletion line when minutesUntilDepletion is not provided', () => {
    const alert = {
      type: 'high_temperature',
      severity: 'warning',
      message: 'Inverter running hot.',
    };

    const result = formatAlertMessage(alert);

    expect(result).not.toContain('⏱');
  });

  // ------------------------------------------------------------------
  // 7.5  truncateMessage passes short message unchanged
  // ------------------------------------------------------------------
  it('7.5 should return the message unchanged when it is within the 4096-char limit', () => {
    const body = 'A'.repeat(100);

    const result = truncateMessage(body);

    expect(result).toBe(body);
    expect(result.length).toBe(100);
  });

  // ------------------------------------------------------------------
  // 7.6  truncateMessage truncates long message to exactly 4096 chars
  // ------------------------------------------------------------------
  it('7.6 should truncate a 5000-char message to 4096 chars ending with "..."', () => {
    const body = 'A'.repeat(5000);

    const result = truncateMessage(body);

    expect(result.length).toBe(4096);
    expect(result.endsWith('...')).toBe(true);
  });

  // ------------------------------------------------------------------
  // 7.7  validatePhoneNumber accepts international format
  // ------------------------------------------------------------------
  it('7.7 should return true for a valid Nigerian international number (+2348031234567)', () => {
    expect(validatePhoneNumber('+2348031234567')).toBe(true);
  });

  // ------------------------------------------------------------------
  // 7.8  validatePhoneNumber accepts local format
  // ------------------------------------------------------------------
  it('7.8 should return true for a valid Nigerian local number (08031234567)', () => {
    expect(validatePhoneNumber('08031234567')).toBe(true);
  });

  // ------------------------------------------------------------------
  // 7.9  validatePhoneNumber rejects short number
  // ------------------------------------------------------------------
  it('7.9 should return false for a number that is too short (12345)', () => {
    expect(validatePhoneNumber('12345')).toBe(false);
  });

  // ------------------------------------------------------------------
  // 7.10  validatePhoneNumber rejects empty string
  // ------------------------------------------------------------------
  it('7.10 should return false for an empty string', () => {
    expect(validatePhoneNumber('')).toBe(false);
  });
});

// ------------------------------------------------------------------
// Section 7: WhatsApp Helpers — Edge Cases
// ------------------------------------------------------------------
describe('WhatsAppHelpers — Edge Cases', () => {
  // ------------------------------------------------------------------
  // E38  Local format normalised — validatePhoneNumber returns true
  // ------------------------------------------------------------------
  it('E38 should accept local Nigerian format (08031234567) as valid', () => {
    const localNumber = '08031234567';

    expect(validatePhoneNumber(localNumber)).toBe(true);
  });

  // ------------------------------------------------------------------
  // E40  Unicode and emoji preserved in formatted message
  // ------------------------------------------------------------------
  it('E40 should preserve Unicode characters and emoji in the formatted output', () => {
    const alert = {
      type: 'high_temperature',
      severity: 'warning',
      message: 'Inverter temp at 65°C — above normal. ⚠️',
    };

    const result = formatAlertMessage(alert);

    expect(result).toContain('⚠️');
    expect(result).toContain('65°C');
  });

  // ------------------------------------------------------------------
  // Extra: warning severity uses ⚠️ icon, not 🚨
  // ------------------------------------------------------------------
  it('should use ⚠️ icon when severity is warning', () => {
    const alert = {
      type: 'battery_depletion',
      severity: 'warning',
      message: 'Battery getting low.',
    };

    const result = formatAlertMessage(alert);

    expect(result).toContain('⚠️');
    expect(result).not.toContain('🚨');
  });

  // ------------------------------------------------------------------
  // Extra: truncateMessage respects a custom maxLength
  // ------------------------------------------------------------------
  it('should truncate to a custom maxLength when provided', () => {
    const body = 'B'.repeat(200);

    const result = truncateMessage(body, 100);

    expect(result.length).toBe(100);
    expect(result.endsWith('...')).toBe(true);
  });

  // ------------------------------------------------------------------
  // Extra: truncateMessage returns message as-is when exactly at limit
  // ------------------------------------------------------------------
  it('should return message unchanged when length equals maxLength exactly', () => {
    const body = 'C'.repeat(4096);

    const result = truncateMessage(body);

    expect(result).toBe(body);
    expect(result.length).toBe(4096);
  });

  // ------------------------------------------------------------------
  // Extra: validatePhoneNumber rejects numbers with wrong prefix
  // ------------------------------------------------------------------
  it('should return false for numbers that do not start with +234 or 0', () => {
    expect(validatePhoneNumber('+4478031234567')).toBe(false);
    expect(validatePhoneNumber('1234567890')).toBe(false);
  });

  // ------------------------------------------------------------------
  // Extra: formatAlertMessage rounds fractional depletion minutes
  // ------------------------------------------------------------------
  it('should round minutesUntilDepletion to the nearest integer in the output', () => {
    const alert = {
      type: 'battery_depletion',
      severity: 'critical',
      message: 'Low battery.',
      minutesUntilDepletion: 12.7,
    };

    const result = formatAlertMessage(alert);

    expect(result).toContain('13 min');
    expect(result).not.toContain('12.7');
  });
});
