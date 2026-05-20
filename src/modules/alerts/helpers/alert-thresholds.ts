// src/modules/alerts/helpers/alert-thresholds.ts
// ==================================================================
// ALERT THRESHOLDS — Pure function for severity determination
// Extracted from AlertDetectionJob.shouldFireAlert will delegate to this
// ==================================================================

import { AlertSeverity } from '../../../common/enums';

export interface DepletionAlertInfo {
  severity: AlertSeverity;
  message: string;
  minutesUntilDepletion: number;
}

/**
 * Determine if an alert should be fired based on depletion calculation.
 *
 * Severity thresholds:
 *   - < 30 min → critical (and > 0)   → CRITICAL alert
 *   - 30–60 min (inclusive) → WARNING alert
 *   - > 60 min, null, or charging → null (no alert, safe zone)
 *
 * @param minutesUntilDepletion - Minutes from depletion engine (null if charging/idle)
 * @param isCharging - Whether the system is net-charging
 * @returns Alert info if alert info or null if safe
 */
export function shouldFireAlert(
  minutesUntilDepletion: number | null,
  isCharging: boolean,
): DepletionAlertInfo | null {
  if (isCharging || minutesUntilDepletion === null) {
    return null;
  }

  if (minutesUntilDepletion <= 0) {
    // Already at or below threshold
    return {
      severity: AlertSeverity.CRITICAL,
      message:
        'Battery has reached the critical depletion threshold. Immediate action required.',
      minutesUntilDepletion: 0,
    };
  }

  if (minutesUntilDepletion < 30) {
    return {
      severity: AlertSeverity.CRITICAL,
      message: `Battery depletion imminent: approximately ${Math.round(minutesUntilDepletion)} minutes remaining. Consider reducing load or switching to grid.`,
      minutesUntilDepletion,
    };
  }

  if (minutesUntilDepletion <= 60) {
    return {
      severity: AlertSeverity.WARNING,
      message: `Battery may deplete in approximately ${Math.round(minutesUntilDepletion)} minutes. Monitor your usage.`,
      minutesUntilDepletion,
    };
  }

  return null; // Safe — more than 60 minutes remaining
}
