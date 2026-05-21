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
 * Net load = actual load - solar generation. If solar covers the load,
 * the battery is net-charging and no alert is needed.
 *
 * The inverterRatedPowerKw field is kept in the interface for future use
 * (e.g. capping solar output) but is NOT used to cap the measured load —
 * loadKw is already a real measured value from the inverter.
 *
 * @param input     - Current metrics snapshot
 * @param threshold - User's depletion threshold % (default 10)
 * @returns DepletionResult with minutes, charging status, net discharge
 */
export function calculateDepletion(
  input: DepletionInput,
  threshold: number = 10,
): DepletionResult {
  const safeSOC = Math.max(0, Math.min(100, input.batterySocPercent));
  const safeCapacity = Math.max(0, input.batteryCapacityKwh);
  const netLoad = Math.max(
    0,
    Math.max(0, input.loadKw) - Math.max(0, input.solarGenKw),
  );

  if (netLoad <= 0) {
    // Solar covers load — battery is net-charging or balanced
    return {
      minutesUntilDepletion: null,
      isCharging: true,
      netDischargeKw: 0,
      thresholdPercent: threshold,
      usedThresholdPercent: threshold,
    };
  }

  // SOC available above the user's depletion threshold
  const usablePercent = safeSOC - threshold;
  if (usablePercent <= 0) {
    // Already at or below threshold — fire immediately
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
