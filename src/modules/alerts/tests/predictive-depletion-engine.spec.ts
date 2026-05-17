// ==================================================================
// PREDICTIVE DEPLETION ENGINE
// ==================================================================
// Tests:      8  (normal behavior + business logic)
// Edge Cases: 12 (boundaries, extremes, anomalies)
// ==================================================================

jest.mock('../../../config/env', () => ({}));

interface DepletionInput {
  batterySocPercent: number;
  loadKw: number;
  batteryCapacityKwh: number;
  solarGenKw: number;
  inverterRatedPowerKw: number;
}

interface DepletionResult {
  minutesUntilDepletion: number | null;
  isCharging: boolean;
  netDischargeKw: number;
  thresholdPercent: number;
  usedThresholdPercent: number;
}

/**
 * Pure function: linear depletion calculator.
 * This is the unit under test — extract to a dedicated service later.
 */
function calculateDepletion(
  input: DepletionInput,
  threshold: number = 10,
): DepletionResult {
  const safeSOC = Math.max(0, Math.min(100, input.batterySocPercent));
  const safeCapacity = Math.max(0, input.batteryCapacityKwh);
  const inverterCap = Math.max(0, input.inverterRatedPowerKw);  
  const demandedFromInverter = Math.min(Math.max(0, input.loadKw), inverterCap);  
  const netLoad = Math.max(0, demandedFromInverter - Math.max(0, input.solarGenKw));

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

// ------------------------------------------------------------------
// TESTS  (1.1 – 1.8)   —   Normal & Business Logic
// ------------------------------------------------------------------
describe('DepletionEngine — Test Cases', () => {
  // Normal depletion scenario
  it('1.1 should calculate minutes until battery hits critical threshold under normal load', () => {
    const result = calculateDepletion({
      batterySocPercent: 80,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
      inverterRatedPowerKw: 8,
    });
    // net = 4kW, usable = 70% of 10kWh = 7kWh, hours = 7/4 = 1.75h = 105min
    expect(result.minutesUntilDepletion).toBeCloseTo(105, 1);
    expect(result.isCharging).toBe(false);
    expect(result.netDischargeKw).toBeCloseTo(4, 1);
  });

  // System is net-charging (no depletion risk)
  it('1.2 should return null depletion when solar exceeds load (net-charging)', () => {
    const result = calculateDepletion({
      batterySocPercent: 70,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 4.5,
      inverterRatedPowerKw: 8,
    });
    expect(result.minutesUntilDepletion).toBeNull();
    expect(result.isCharging).toBe(true);
  });

  // Already below threshold
  it('1.3 should return 0 minutes when battery is already below critical threshold', () => {
    const result = calculateDepletion({
      batterySocPercent: 8,
      loadKw: 2,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
      inverterRatedPowerKw: 5,
    });
    expect(result.minutesUntilDepletion).toBe(0);
    expect(result.isCharging).toBe(false);
  });

  // Exactly at threshold boundary
  it('1.4 should return 0 when SOC exactly equals threshold', () => {
    const result = calculateDepletion({
      batterySocPercent: 10,
      loadKw: 1,
      batteryCapacityKwh: 5,
      solarGenKw: 0,
      inverterRatedPowerKw: 5,
    });
    expect(result.minutesUntilDepletion).toBe(0);
  });

  // Large load, fast depletion
  it('1.5 should show fast depletion under high load with little solar', () => {
    const result = calculateDepletion({
      batterySocPercent: 30,
      loadKw: 10,
      batteryCapacityKwh: 5,
      solarGenKw: 0.2,
      inverterRatedPowerKw: 12,
    });
    // net = 9.8kW, usable = 20% of 5 = 1kWh, hours = 1/9.8 ≈ 6.12min
    expect(result.minutesUntilDepletion).toBeLessThan(7);
    expect(result.netDischargeKw).toBeCloseTo(9.8, 1);
  });

  it('1.6 should double depletion time when solar covers half the load', () => {
    const withoutSolar = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 4,
      batteryCapacityKwh: 10,
      solarGenKw: 0,          // net = 4kW
      inverterRatedPowerKw: 6,
    });
    const withSolar = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 4,
      batteryCapacityKwh: 10,
      solarGenKw: 2,          // net = 2kW (half)
      inverterRatedPowerKw: 6,
    });
    // Depletion with solar should be roughly double
    expect(withSolar.minutesUntilDepletion).toBeCloseTo(
      withoutSolar.minutesUntilDepletion! * 2, 0,
    );
  });

  it('1.7 should return null when system is idle (zero load, zero solar)', () => {
    const result = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 0,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 5,
    });
    expect(result.minutesUntilDepletion).toBeNull();
    expect(result.isCharging).toBe(true);
  });

  it('1.8 should calculate very short depletion when barely above threshold', () => {
    const result = calculateDepletion({
      batterySocPercent: 10.5,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 8,
    });
    // usable = 0.5% of 10kWh = 0.05kWh, net = 5kW
    // hours = 0.05/5 = 0.01h = 0.6min
    expect(result.minutesUntilDepletion).toBeCloseTo(0.6, 1);
  });
});

// ------------------------------------------------------------------
// EDGE CASES  —   Boundaries, Extremes, Anomalies
// ------------------------------------------------------------------
describe('DepletionEngine — Edge Cases', () => {
  it('E1 should handle 100% SOC with heavy load', () => {
    const result = calculateDepletion({
      batterySocPercent: 100,
      loadKw: 15,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 20,
    });
    // usable = 90% of 10 = 9kWh, net = 15kW, hours = 9/15 = 0.6h = 36min
    expect(result.minutesUntilDepletion).toBeCloseTo(36, 0);
    expect(result.isCharging).toBe(false);
  });

  it('E2 should handle 0% SOC (battery flat)', () => {
    const result = calculateDepletion({
      batterySocPercent: 0,
      loadKw: 2,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 5,
    });
    expect(result.minutesUntilDepletion).toBe(0);
  });

  it('E3 should treat negative SOC as 0% without crashing', () => {
    const result = calculateDepletion({
      batterySocPercent: -5,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
      inverterRatedPowerKw: 5,
    });
    expect(result.minutesUntilDepletion).toBe(0);
    expect(result.netDischargeKw).toBeGreaterThanOrEqual(0);
  });

  it('E4 should clamp SOC above 100% to 100%', () => {
    const result = calculateDepletion({
      batterySocPercent: 110,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 8,
    });
    // Should behave same as E1 for 100%
    expect(result.minutesUntilDepletion).toBeCloseTo(
      calculateDepletion({ batterySocPercent: 100, loadKw: 5, batteryCapacityKwh: 10, solarGenKw: 0, inverterRatedPowerKw: 8 }).minutesUntilDepletion!, 0,
    );
  });

  it('E5 should handle zero load with positive solar (pure charging)', () => {
    const result = calculateDepletion({
      batterySocPercent: 30,
      loadKw: 0,
      batteryCapacityKwh: 10,
      solarGenKw: 5,
      inverterRatedPowerKw: 8,
    });
    expect(result.minutesUntilDepletion).toBeNull();
    expect(result.isCharging).toBe(true);
  });

  it('E6 should handle zero load and zero solar (idle — no change)', () => {
    const result = calculateDepletion({
      batterySocPercent: 30,
      loadKw: 0,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 8,
    });
    expect(result.minutesUntilDepletion).toBeNull();
  });

  it('E7 should handle zero battery capacity without division-by-zero', () => {
    const result = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 2,
      batteryCapacityKwh: 0,
      solarGenKw: 0,
      inverterRatedPowerKw: 5,
    });
    // No capacity means instant depletion
    expect(result.minutesUntilDepletion).toBe(0);
  });

  it('E8 should handle extremely small battery capacity (100Wh)', () => {
    const result = calculateDepletion({
      batterySocPercent: 80,
      loadKw: 2,
      batteryCapacityKwh: 0.1,
      solarGenKw: 0,
      inverterRatedPowerKw: 3,
    });
    // usable = 70% of 0.1 = 0.07kWh, net = 2kW, hours = 0.07/2 = 0.035h = 2.1min
    expect(result.minutesUntilDepletion).toBeCloseTo(2.1, 0);
  });

  it('E9 should handle load exceeding inverter rated power', () => {
    // Inverter can't supply full load; remaining comes from grid
    // Depletion still based on net battery draw
    const result = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 7,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
      inverterRatedPowerKw: 5,
    });
    // inverter output capped at 5kW; with 1kW solar, battery draw is 4kW  
+   expect(result.netDischargeKw).toBe(4);  
    expect(result.minutesUntilDepletion).toBeGreaterThan(0);
  });

  it('E10 should correctly handle high-precision decimal SOC', () => {
    const result = calculateDepletion({
      batterySocPercent: 45.67891234,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
      inverterRatedPowerKw: 6,
    });
    // Should not throw floating-point errors
    expect(Number.isFinite(result.minutesUntilDepletion)).toBe(true);
    expect(typeof result.minutesUntilDepletion).toBe('number');
  });

  it('E11 should handle user-defined threshold of 0% (deplete to empty)', () => {
    const result = calculateDepletion(
      { batterySocPercent: 10, loadKw: 5, batteryCapacityKwh: 10, solarGenKw: 0, inverterRatedPowerKw: 8 },
      0,
    );
    // usable = 10% of 10 = 1kWh, net = 5kW, hours = 1/5 = 0.2h = 12min
    expect(result.minutesUntilDepletion).toBeCloseTo(12, 0);
    expect(result.thresholdPercent).toBe(0);
  });

  it('E12 should handle custom threshold of 20% (user-configured)', () => {
    const result = calculateDepletion(
      { batterySocPercent: 50, loadKw: 2, batteryCapacityKwh: 10, solarGenKw: 0, inverterRatedPowerKw: 5 },
      20,
    );
    // usable = 30% of 10 = 3kWh, net = 2kW, hours = 3/2 = 1.5h = 90min
    expect(result.minutesUntilDepletion).toBeCloseTo(90, 0);
    expect(result.thresholdPercent).toBe(20);
  });
});