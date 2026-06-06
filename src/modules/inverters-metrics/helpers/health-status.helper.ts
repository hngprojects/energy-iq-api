/**
 * Health status helper - pure function, no I/O.
 *
 * The ticket (DASH-BE-003) uses normal | warning | critical but the codebase
 * adds GREY to the colours. Colours map as:
 *   GREEN  → normal
 *   AMBER  → warning
 *   RED    → critical
 *   GREY   → offline (no ticket equivalent; added post-ticket)
 *
 * Precedence: GREY > RED > AMBER > GREEN
 */

export type HealthStatus = 'GREEN' | 'AMBER' | 'RED' | 'GREY';

export interface HealthResult {
  status: HealthStatus;
  reason: string;
}

export interface HealthInput {
  socPercent: number | null;
  solarKw: number;
  panelCapacityKw: number;
  systemOffline: boolean;
  localHour?: number;
  criticalSocThreshold?: number;
  lowSocThreshold?: number;
}

/** Daytime window during which solar generation is expected (WAT, inclusive). */
const SOLAR_DAYTIME_START_HOUR = 6;
const SOLAR_DAYTIME_END_HOUR = 19;

function isDaytime(localHour: number): boolean {
  return (
    localHour >= SOLAR_DAYTIME_START_HOUR && localHour < SOLAR_DAYTIME_END_HOUR
  );
}

export function computeHealthStatus(input: HealthInput): HealthResult {
  const {
    socPercent,
    solarKw,
    panelCapacityKw,
    systemOffline,
    criticalSocThreshold = 15,
    lowSocThreshold = 30,
  } = input;

  // Resolve local hour - default to current WAT (UTC+1) hour
  const localHour =
    input.localHour ?? new Date(Date.now() + 60 * 60 * 1000).getUTCHours();

  // GREY: offline - health is unknown
  if (systemOffline) {
    return {
      status: 'GREY',
      reason: 'Inverter is offline; health status is unavailable',
    };
  }

  // RED: null SoC - data missing from an online inverter
  if (socPercent === null) {
    return {
      status: 'RED',
      reason: 'Battery data unavailable',
    };
  }

  // RED: critically low battery
  if (socPercent <= criticalSocThreshold) {
    return {
      status: 'RED',
      reason: `Battery state of charge is critically low (≤${criticalSocThreshold}%)`,
    };
  }

  // RED: low battery with no solar recovery path
  if (socPercent <= lowSocThreshold && solarKw === 0 && isDaytime(localHour)) {
    return {
      status: 'RED',
      reason: `Battery is low (≤${lowSocThreshold}%) with no solar generation during daylight`,
    };
  }

  // AMBER checks
  const solarLowThreshold = panelCapacityKw * 0.3;
  // Only flag weak solar during daytime and when capacity is known
  const isSolarLow =
    isDaytime(localHour) && panelCapacityKw > 0 && solarKw < solarLowThreshold;

  const isBatteryLow = socPercent <= lowSocThreshold;

  if (isBatteryLow && isSolarLow) {
    return {
      status: 'AMBER',
      reason: `Battery is low (≤${lowSocThreshold}%) and solar generation is below 30% of panel capacity`,
    };
  }

  if (isBatteryLow) {
    return {
      status: 'AMBER',
      reason: `Battery state of charge is low (≤${lowSocThreshold}%)`,
    };
  }

  if (isSolarLow) {
    return {
      status: 'AMBER',
      reason: 'Solar generation is below 30% of panel capacity',
    };
  }

  // GREEN: all good
  return {
    status: 'GREEN',
    reason: 'System operating normally',
  };
}
