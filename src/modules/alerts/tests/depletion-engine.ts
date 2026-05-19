// ==================================================================
// PREDICTIVE DEPLETION ENGINE — Pure Function
// Calculates minutes until battery hits critical SOC threshold.
// ==================================================================

export interface DepletionInput {
  batterySocPercent: number;
  loadKw: number;
  batteryCapacityKwh: number;
  solarGenKw: number;
  inverterRatedPowerKw: number;
}

export interface DepletionResult {
  minutesUntilDepletion: number | null;
  isCharging: boolean;
  netDischargeKw: number;
  thresholdPercent: number;
  usedThresholdPercent: number;
}

/**
 * Linear approximation of battery depletion time.
 *
 * @param input  - Current metrics snapshot
 * @param threshold - User's custom depletion threshold (default 10%)
 * @returns DepletionResult with minutes, charging status, net discharge
 */
export function calculateDepletion(
  input: DepletionInput,
  threshold: number = 10,
): DepletionResult {
  const safeSOC = Math.max(0, Math.min(100, input.batterySocPercent));
  const safeCapacity = Math.max(0, input.batteryCapacityKwh);
  const inverterCap = Math.max(0, input.inverterRatedPowerKw);
  const demandedFromInverter = Math.min(Math.max(0, input.loadKw), inverterCap);
  const netLoad = Math.max(
    0,
    demandedFromInverter - Math.max(0, input.solarGenKw),
  );

  if (netLoad <= 0) {
    // System is net-charging; no depletion risk
    return {
      minutesUntilDepletion: null,
      isCharging: true,
      netDischargeKw: 0,
      thresholdPercent: threshold,
      usedThresholdPercent: threshold,
    };
  }

  // SOC available above threshold
  const usablePercent = safeSOC - threshold;
  if (usablePercent <= 0) {
    // Already below threshold
    return {
      minutesUntilDepletion: 0,
      isCharging: false,
      netDischargeKw: Math.round(netLoad * 100) / 100,
      thresholdPercent: threshold,
      usedThresholdPercent: threshold,
    };
  }

  const usableKwh = (usablePercent / 100) * safeCapacity;
  const hours = safeCapacity > 0 && netLoad > 0 ? usableKwh / netLoad : 0;
  const minutes = hours * 60;

  return {
    minutesUntilDepletion: Math.round(minutes * 100) / 100,
    isCharging: false,
    netDischargeKw: Math.round(netLoad * 100) / 100,
    thresholdPercent: threshold,
    usedThresholdPercent: threshold,
  };
}