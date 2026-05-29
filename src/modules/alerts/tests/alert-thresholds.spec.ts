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

// ==================================================================
// SOLAR UNDERPERFORMANCE THRESHOLD DETECTION
// Tests for shouldFireSolarAlert() in helpers/alert-thresholds.ts
// Pure function — no mocks needed.
// ==================================================================

import { shouldFireSolarAlert } from '../helpers/alert-thresholds';

describe('shouldFireSolarAlert — Test Cases', () => {
  it('S1 should return null when solarPowerKw is null (no data)', () => {
    expect(shouldFireSolarAlert(null, 10)).toBeNull();
  });

  it('S2 should return null when solarPowerKw is 0 (panels not producing)', () => {
    expect(shouldFireSolarAlert(0, 10)).toBeNull();
  });

  it('S3 should return null when panelCapacityKw is 0 (not configured)', () => {
    expect(shouldFireSolarAlert(1, 0)).toBeNull();
  });

  it('S4 should return null when panelCapacityKw is negative', () => {
    expect(shouldFireSolarAlert(1, -5)).toBeNull();
  });

  it('S5 should return CRITICAL when output is below 15% of capacity', () => {
    // 1 kW output on a 10 kW system = 10% — CRITICAL
    const result = shouldFireSolarAlert(1, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    expect(result!.solarPowerKw).toBe(1);
    expect(result!.panelCapacityKw).toBe(10);
    expect(result!.performanceRatioPercent).toBe(10);
    expect(result!.message).toContain('10%');
  });

  it('S6 should return WARNING when output is between 15% and 30% of capacity', () => {
    // 2 kW output on a 10 kW system = 20% — WARNING
    const result = shouldFireSolarAlert(2, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    expect(result!.performanceRatioPercent).toBe(20);
  });

  it('S7 should return null when output is at or above 30% of capacity (adequate)', () => {
    // 3 kW output on a 10 kW system = 30% — safe zone
    expect(shouldFireSolarAlert(3, 10)).toBeNull();
  });

  it('S8 should return null when output is well above 30% (normal operation)', () => {
    // 7 kW output on a 10 kW system = 70%
    expect(shouldFireSolarAlert(7, 10)).toBeNull();
  });

  it('S9 should return CRITICAL at exactly 14.9% (just under CRITICAL boundary)', () => {
    const result = shouldFireSolarAlert(1.49, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
  });

  it('S10 should return WARNING at exactly 15% (boundary between CRITICAL and WARNING)', () => {
    // 1.5 kW on 10 kW = exactly 15%
    const result = shouldFireSolarAlert(1.5, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
  });

  it('S11 should return WARNING at 29.9% (just under safe boundary)', () => {
    const result = shouldFireSolarAlert(2.99, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
  });

  it('S12 should include solar output and panel capacity in the message', () => {
    const result = shouldFireSolarAlert(1, 10);

    expect(result!.message).toContain('1.00 kW');
    expect(result!.message).toContain('10 kW');
  });

  it('S13 should work correctly with small panel systems (e.g. 2 kW)', () => {
    // 0.2 kW on a 2 kW system = 10% — CRITICAL
    const result = shouldFireSolarAlert(0.2, 2);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    expect(result!.performanceRatioPercent).toBe(10);
  });

  it('S14 should work correctly with large panel systems (e.g. 50 kW)', () => {
    // 10 kW on a 50 kW system = 20% — WARNING
    const result = shouldFireSolarAlert(10, 50);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    expect(result!.performanceRatioPercent).toBe(20);
  });
});

// ==================================================================
// HIGH LOAD SPIKE THRESHOLD DETECTION
// Tests for shouldFireHighLoadAlert() in helpers/alert-thresholds.ts
// Pure function — no mocks needed.
// ==================================================================

import { shouldFireHighLoadAlert } from '../helpers/alert-thresholds';

describe('shouldFireHighLoadAlert — Test Cases', () => {
  it('L1 should return null when loadKw is null (no data)', () => {
    expect(shouldFireHighLoadAlert(null, 10)).toBeNull();
  });

  it('L2 should return null when loadKw is 0 (no load)', () => {
    expect(shouldFireHighLoadAlert(0, 10)).toBeNull();
  });

  it('L3 should return null when ratedCapacityKw is 0 (not configured)', () => {
    expect(shouldFireHighLoadAlert(5, 0)).toBeNull();
  });

  it('L4 should return null when ratedCapacityKw is negative', () => {
    expect(shouldFireHighLoadAlert(5, -10)).toBeNull();
  });

  it('L5 should return null when load is below 85% of rated capacity (normal)', () => {
    // 8 kW on a 10 kW system = 80%
    expect(shouldFireHighLoadAlert(8, 10)).toBeNull();
  });

  it('L6 should return WARNING when load is between 85% and 95% of rated capacity', () => {
    // 9 kW on a 10 kW system = 90%
    const result = shouldFireHighLoadAlert(9, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    expect(result!.loadKw).toBe(9);
    expect(result!.ratedCapacityKw).toBe(10);
    expect(result!.loadRatioPercent).toBe(90);
    expect(result!.message).toContain('90%');
  });

  it('L7 should return CRITICAL when load exceeds 95% of rated capacity', () => {
    // 9.6 kW on a 10 kW system = 96%
    const result = shouldFireHighLoadAlert(9.6, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
    expect(result!.loadRatioPercent).toBe(96);
    expect(result!.message).toContain('overload');
  });

  it('L8 should return WARNING at exactly 85.1% (just above WARNING boundary)', () => {
    const result = shouldFireHighLoadAlert(8.51, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
  });

  it('L9 should return null at exactly 85% (boundary is exclusive — below threshold)', () => {
    // 8.5 kW on 10 kW = exactly 85% — ratio is 0.85, not > 0.85
    expect(shouldFireHighLoadAlert(8.5, 10)).toBeNull();
  });

  it('L10 should return WARNING at 95% (boundary between WARNING and CRITICAL)', () => {
    // 9.5 kW on 10 kW = exactly 95% — ratio is 0.95, not > 0.95
    const result = shouldFireHighLoadAlert(9.5, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
  });

  it('L11 should return CRITICAL at 95.1% (just above CRITICAL boundary)', () => {
    const result = shouldFireHighLoadAlert(9.51, 10);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
  });

  it('L12 should include load and rated capacity in the message', () => {
    const result = shouldFireHighLoadAlert(9, 10);

    expect(result!.message).toContain('9.00 kW');
    expect(result!.message).toContain('10 kW');
  });

  it('L13 should work correctly with small inverters (e.g. 3 kW)', () => {
    // 2.9 kW on a 3 kW system = ~97% — CRITICAL
    const result = shouldFireHighLoadAlert(2.9, 3);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.CRITICAL);
  });

  it('L14 should work correctly with large inverters (e.g. 30 kW)', () => {
    // 27 kW on a 30 kW system = 90% — WARNING
    const result = shouldFireHighLoadAlert(27, 30);

    expect(result).not.toBeNull();
    expect(result!.severity).toBe(AlertSeverity.WARNING);
    expect(result!.loadRatioPercent).toBe(90);
  });
});
