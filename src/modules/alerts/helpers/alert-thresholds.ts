// src/modules/alerts/helpers/alert-thresholds.ts
// ==================================================================
// ALERT THRESHOLDS — Pure functions for severity determination
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

// ==================================================================
// SOLAR UNDERPERFORMANCE
// ==================================================================

export interface SolarAlertInfo {
  severity: AlertSeverity;
  message: string;
  solarPowerKw: number;
  panelCapacityKw: number;
  performanceRatioPercent: number;
}

/**
 * Minimum absolute output (kW) below which solar underperformance is not
 * evaluated. Prevents false alerts during dawn/dusk ramp-up when a large
 * array produces a tiny but non-zero output.
 */
const SOLAR_MIN_ABSOLUTE_KW = 0.1;

/**
 * Minimum output as a fraction of panel capacity below which solar
 * underperformance is not evaluated. Applied as a floor alongside
 * SOLAR_MIN_ABSOLUTE_KW — whichever is larger wins.
 *
 * Example: a 10 kW array requires at least max(0.1, 10 * 0.05) = 0.5 kW
 * before the 15%/30% thresholds are checked.
 */
const SOLAR_MIN_FRACTION = 0.05;

/**
 * Determine if solar output is underperforming relative to panel capacity.
 *
 * Only fires when panels are producing above a meaningful floor — this
 * avoids false alerts during dawn/dusk ramp-up when a large array produces
 * a tiny but non-zero output.
 *
 * Production floor: max(SOLAR_MIN_ABSOLUTE_KW, panelCapacityKw * SOLAR_MIN_FRACTION)
 * If solarPowerKw is below this floor, the function returns null regardless
 * of the ratio.
 *
 * Thresholds (applied only above the floor):
 *   - Output < 15% of panel capacity → CRITICAL (severe underperformance,
 *     likely a hardware fault or complete shading)
 *   - Output 15–30% of panel capacity → WARNING (moderate underperformance,
 *     may be partial shading, dirty panels, or degradation)
 *   - Output > 30% or below production floor → null (safe zone)
 *
 * @param solarPowerKw     - Current solar output in kW (null if not available)
 * @param panelCapacityKw  - Inverter's rated panel peak capacity in kW
 * @returns SolarAlertInfo or null if no alert needed
 */
export function shouldFireSolarAlert(
  solarPowerKw: number | null,
  panelCapacityKw: number,
): SolarAlertInfo | null {
  // No data or panels not producing
  if (solarPowerKw === null || solarPowerKw <= 0) {
    return null;
  }

  // Panel capacity not configured or too small to be meaningful
  if (panelCapacityKw <= 0) {
    return null;
  }

  // Require a meaningful production floor before evaluating thresholds.
  // This prevents dawn/dusk ramp-up from triggering false alerts.
  const productionFloor = Math.max(
    SOLAR_MIN_ABSOLUTE_KW,
    panelCapacityKw * SOLAR_MIN_FRACTION,
  );
  if (solarPowerKw < productionFloor) {
    return null;
  }

  const ratio = solarPowerKw / panelCapacityKw;
  const performanceRatioPercent = Math.round(ratio * 100);

  if (ratio < 0.15) {
    return {
      severity: AlertSeverity.CRITICAL,
      message: `Solar output is critically low at ${solarPowerKw.toFixed(2)} kW — only ${performanceRatioPercent}% of your ${panelCapacityKw} kW panel capacity. Check for hardware faults or complete shading.`,
      solarPowerKw,
      panelCapacityKw,
      performanceRatioPercent,
    };
  }

  if (ratio < 0.3) {
    return {
      severity: AlertSeverity.WARNING,
      message: `Solar output is below expected levels at ${solarPowerKw.toFixed(2)} kW — ${performanceRatioPercent}% of your ${panelCapacityKw} kW panel capacity. Panels may be dirty, partially shaded, or degrading.`,
      solarPowerKw,
      panelCapacityKw,
      performanceRatioPercent,
    };
  }

  return null; // Performing adequately
}

// ==================================================================
// HIGH LOAD SPIKE
// ==================================================================

export interface HighLoadAlertInfo {
  severity: AlertSeverity;
  message: string;
  loadKw: number;
  ratedCapacityKw: number;
  loadRatioPercent: number;
}

/**
 * Determine if AC output load is spiking relative to the inverter's rated
 * panel/output capacity.
 *
 * Uses `panelCapacityKw` as the rated output ceiling — it's the best proxy
 * available on the inverter entity for maximum sustainable output.
 *
 * Thresholds:
 *   - Load > 95% of rated capacity → CRITICAL (inverter near its limit,
 *     risk of overload trip or hardware damage)
 *   - Load 85–95% of rated capacity → WARNING (high sustained load,
 *     battery draining faster than expected)
 *   - Load < 85% or no data → null (normal operating range)
 *
 * @param loadKw           - Current AC output load in kW (null if not available)
 * @param ratedCapacityKw  - Inverter's rated panel/output capacity in kW
 * @returns HighLoadAlertInfo or null if no alert needed
 */
export function shouldFireHighLoadAlert(
  loadKw: number | null,
  ratedCapacityKw: number,
): HighLoadAlertInfo | null {
  // No data or no load
  if (loadKw === null || loadKw <= 0) {
    return null;
  }

  // Capacity not configured or too small to be meaningful
  if (ratedCapacityKw <= 0) {
    return null;
  }

  const ratio = loadKw / ratedCapacityKw;
  const loadRatioPercent = Math.round(ratio * 100);

  if (ratio > 0.95) {
    return {
      severity: AlertSeverity.CRITICAL,
      message: `Load is critically high at ${loadKw.toFixed(2)} kW — ${loadRatioPercent}% of your inverter's ${ratedCapacityKw} kW rated capacity. Risk of overload. Reduce consumption immediately.`,
      loadKw,
      ratedCapacityKw,
      loadRatioPercent,
    };
  }

  if (ratio > 0.85) {
    return {
      severity: AlertSeverity.WARNING,
      message: `Load is elevated at ${loadKw.toFixed(2)} kW — ${loadRatioPercent}% of your inverter's ${ratedCapacityKw} kW rated capacity. Consider reducing consumption to avoid overload.`,
      loadKw,
      ratedCapacityKw,
      loadRatioPercent,
    };
  }

  return null; // Within normal operating range
}
