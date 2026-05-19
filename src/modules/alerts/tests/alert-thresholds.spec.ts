// ==================================================================
// ALERT THRESHOLD DETECTION
// Tests for shouldFireAlert() in helpers/alert-thresholds.ts
// Pure function — no mocks needed.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { shouldFireAlert } from '../helpers/alert-thresholds';
import { AlertSeverity } from '../../../common/enums';

describe('shouldFireAlert — Test Cases', () => {
  it('2.1 should return CRITICAL when depletion is under 30 minutes', () => {
    const result = shouldFireAlert(20, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    expect(result!.minutesUntilDepletion).toBe(20);
    expect(result!.message).toContain('20');
  });

  it('2.2 should return WARNING when depletion is between 30 and 60 minutes', () => {
    const result = shouldFireAlert(45, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    expect(result!.minutesUntilDepletion).toBe(45);
    expect(result!.message).toContain('45');
  });

  it('2.3 should return null when depletion is more than 60 minutes (safe zone)', () => {
    const result = shouldFireAlert(90, false);

    expect(result).toBeNull();
  });

  it('2.4 should return null when system is charging (isCharging=true)', () => {
    const result = shouldFireAlert(null, true);

    expect(result).toBeNull();
  });

  it('2.5 should return null when minutesUntilDepletion is null (idle/no risk)', () => {
    const result = shouldFireAlert(null, false);

    expect(result).toBeNull();
  });

  it('2.6 should return CRITICAL when minutesUntilDepletion is exactly 0', () => {
    const result = shouldFireAlert(0, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    expect(result!.minutesUntilDepletion).toBe(0);
    expect(result!.message).toContain('Immediate action required');
  });

  it('2.7 should return CRITICAL at 29.9 minutes (just under the 30-min boundary)', () => {
    const result = shouldFireAlert(29.9, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    expect(result!.minutesUntilDepletion).toBe(29.9);
  });

  it('2.8 should return WARNING at exactly 30 minutes (boundary is WARNING, not CRITICAL)', () => {
    const result = shouldFireAlert(30, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    expect(result!.minutesUntilDepletion).toBe(30);
  });

  it('2.9 should return WARNING at exactly 60 minutes (upper boundary is still WARNING)', () => {
    const result = shouldFireAlert(60, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    expect(result!.minutesUntilDepletion).toBe(60);
  });

  it('2.10 should return null at 60.1 minutes (just above the safe boundary)', () => {
    const result = shouldFireAlert(60.1, false);

    expect(result).toBeNull();
  });
});

describe('shouldFireAlert — Edge Cases', () => {
  it('should return CRITICAL for negative minutes (already past threshold)', () => {
    // Negative values mean the battery is already below threshold
    const result = shouldFireAlert(-1, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    expect(result!.minutesUntilDepletion).toBe(0);
  });

  it('should return null when charging even if minutesUntilDepletion is 0', () => {
    // isCharging takes priority — if charging, no alert regardless of minutes
    const result = shouldFireAlert(0, true);

    expect(result).toBeNull();
  });

  it('should return null when charging even if minutesUntilDepletion is 5', () => {
    const result = shouldFireAlert(5, true);

    expect(result).toBeNull();
  });

  it('should include rounded minutes in the CRITICAL message', () => {
    const result = shouldFireAlert(14.7, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    // Message should show rounded value (15), not raw decimal
    expect(result!.message).toContain('15');
  });

  it('should include rounded minutes in the WARNING message', () => {
    const result = shouldFireAlert(44.3, false);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    // Message should show rounded value (44), not raw decimal
    expect(result!.message).toContain('44');
  });

  it('should return the exact minutesUntilDepletion value in the result object', () => {
    // The result object preserves the raw value even if the message rounds it
    const result = shouldFireAlert(14.7, false);

    expect(result!.minutesUntilDepletion).toBe(14.7);
  });
});
