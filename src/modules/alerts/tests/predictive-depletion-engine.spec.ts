// ==================================================================
// PREDICTIVE DEPLETION ENGINE
// Tests for calculateDepletion() in helpers/depletion-engine.ts
// Pure function — no mocks needed.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { calculateDepletion } from '../helpers/depletion-engine';

// ------------------------------------------------------------------
// TESTS  (1.1 – 1.8)   —   Normal & Business Logic
// ------------------------------------------------------------------
describe('DepletionEngine — Test Cases', () => {
  it('1.1 should calculate minutes until battery hits critical threshold under normal load', () => {
    const result = calculateDepletion({
      batterySocPercent: 80,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
      inverterRatedPowerKw: 8,
    });
    // net = min(5,8) - 1 = 4kW
    // usable = (80-10)% of 10kWh = 7kWh
    // hours = 7/4 = 1.75h = 105min
    expect(result.minutesUntilDepletion).toBeCloseTo(105, 1);
    expect(result.isCharging).toBe(false);
    expect(result.netDischargeKw).toBeCloseTo(4, 1);
  });

  it('1.2 should return null depletion when solar exceeds load (net-charging)', () => {
    const result = calculateDepletion({
      batterySocPercent: 70,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 4.5,
      inverterRatedPowerKw: 8,
    });
    // net = max(0, 3 - 4.5) = 0 → charging
    expect(result.minutesUntilDepletion).toBeNull();
    expect(result.isCharging).toBe(true);
    expect(result.netDischargeKw).toBe(0);
  });

  it('1.3 should return 0 minutes when battery is already below critical threshold', () => {
    const result = calculateDepletion({
      batterySocPercent: 8,
      loadKw: 2,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
      inverterRatedPowerKw: 5,
    });
    // SOC 8% < threshold 10% → already depleted
    expect(result.minutesUntilDepletion).toBe(0);
    expect(result.isCharging).toBe(false);
  });

  it('1.4 should return 0 when SOC exactly equals threshold', () => {
    const result = calculateDepletion({
      batterySocPercent: 10,
      loadKw: 1,
      batteryCapacityKwh: 5,
      solarGenKw: 0,
      inverterRatedPowerKw: 5,
    });
    // usablePercent = 10 - 10 = 0 → already at threshold
    expect(result.minutesUntilDepletion).toBe(0);
    expect(result.isCharging).toBe(false);
  });

  it('1.5 should show fast depletion under high load with little solar', () => {
    const result = calculateDepletion({
      batterySocPercent: 30,
      loadKw: 10,
      batteryCapacityKwh: 5,
      solarGenKw: 0.2,
      inverterRatedPowerKw: 12,
    });
    // net = min(10,12) - 0.2 = 9.8kW
    // usable = (30-10)% of 5kWh = 1kWh
    // hours = 1/9.8 ≈ 0.102h ≈ 6.12min
    expect(result.minutesUntilDepletion).toBeLessThan(7);
    expect(result.minutesUntilDepletion).toBeGreaterThan(0);
    expect(result.netDischargeKw).toBeCloseTo(9.8, 1);
  });

  it('1.6 should double depletion time when solar covers half the load', () => {
    const withoutSolar = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 4,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 6,
    });
    const withSolar = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 4,
      batteryCapacityKwh: 10,
      solarGenKw: 2,
      inverterRatedPowerKw: 6,
    });
    // net without solar = 4kW, net with solar = 2kW → double the time
    expect(withSolar.minutesUntilDepletion).toBeCloseTo(
      withoutSolar.minutesUntilDepletion! * 2,
      0,
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
    // net = max(0, 0 - 0) = 0 → treated as charging/idle
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
    expect(result.minutesUntilDepletion).toBeLessThan(2);
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
    // usable = (100-10)% of 10kWh = 9kWh, net = 15kW
    // hours = 9/15 = 0.6h = 36min
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
    // SOC 0% < threshold 10% → already depleted
    expect(result.minutesUntilDepletion).toBe(0);
    expect(result.isCharging).toBe(false);
  });

  it('E3 should treat negative SOC as 0% without crashing', () => {
    const result = calculateDepletion({
      batterySocPercent: -5,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
      inverterRatedPowerKw: 5,
    });
    // safeSOC = max(0, -5) = 0 → below threshold
    expect(result.minutesUntilDepletion).toBe(0);
    expect(result.netDischargeKw).toBeGreaterThanOrEqual(0);
    expect(result.isCharging).toBe(false);
  });

  it('E4 should clamp SOC above 100% to 100%', () => {
    const clamped = calculateDepletion({
      batterySocPercent: 110,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 8,
    });
    const normal = calculateDepletion({
      batterySocPercent: 100,
      loadKw: 5,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 8,
    });
    // Both should produce identical results
    expect(clamped.minutesUntilDepletion).toBe(normal.minutesUntilDepletion);
    expect(clamped.netDischargeKw).toBe(normal.netDischargeKw);
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
    expect(result.netDischargeKw).toBe(0);
  });

  it('E6 should handle zero load and zero solar (idle — no change in SOC)', () => {
    const result = calculateDepletion({
      batterySocPercent: 30,
      loadKw: 0,
      batteryCapacityKwh: 10,
      solarGenKw: 0,
      inverterRatedPowerKw: 8,
    });
    expect(result.minutesUntilDepletion).toBeNull();
    expect(result.isCharging).toBe(true);
  });

  it('E7 should handle zero battery capacity without division-by-zero or NaN', () => {
    const result = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 2,
      batteryCapacityKwh: 0,
      solarGenKw: 0,
      inverterRatedPowerKw: 5,
    });
    // usableKwh = 0, hours = 0 → 0 minutes
    expect(result.minutesUntilDepletion).toBe(0);
    expect(Number.isNaN(result.minutesUntilDepletion)).toBe(false);
    expect(Number.isFinite(result.minutesUntilDepletion!)).toBe(true);
  });

  it('E8 should handle extremely small battery capacity (100Wh = 0.1kWh)', () => {
    const result = calculateDepletion({
      batterySocPercent: 80,
      loadKw: 2,
      batteryCapacityKwh: 0.1,
      solarGenKw: 0,
      inverterRatedPowerKw: 3,
    });
    // usable = 70% of 0.1kWh = 0.07kWh, net = 2kW
    // hours = 0.07/2 = 0.035h = 2.1min
    expect(result.minutesUntilDepletion).toBeCloseTo(2.1, 0);
    expect(result.minutesUntilDepletion).toBeGreaterThan(0);
  });

  it('E9 should cap load at inverter rated power when load exceeds it', () => {
    const result = calculateDepletion({
      batterySocPercent: 50,
      loadKw: 7,
      batteryCapacityKwh: 10,
      solarGenKw: 1,
      inverterRatedPowerKw: 5,
    });
    // Measured value shouldn't be capped
    // (not 7 - 1 = 6kW)
    expect(result.netDischargeKw).toBe(6);
    expect(result.minutesUntilDepletion).toBeGreaterThan(0);
  });

  it('E11 should handle high-precision decimal SOC without floating-point errors', () => {
    const result = calculateDepletion({
      batterySocPercent: 45.67891234,
      loadKw: 3,
      batteryCapacityKwh: 10,
      solarGenKw: 0.5,
      inverterRatedPowerKw: 6,
    });
    expect(Number.isFinite(result.minutesUntilDepletion)).toBe(true);
    expect(Number.isNaN(result.minutesUntilDepletion)).toBe(false);
    // Result should be rounded to 2 decimal places
    const str = result.minutesUntilDepletion!.toString();
    const decimals = str.includes('.') ? str.split('.')[1].length : 0;
    expect(decimals).toBeLessThanOrEqual(2);
  });

  it('E12 should handle user-defined threshold of 0% (deplete to completely empty)', () => {
    const result = calculateDepletion(
      {
        batterySocPercent: 10,
        loadKw: 5,
        batteryCapacityKwh: 10,
        solarGenKw: 0,
        inverterRatedPowerKw: 8,
      },
      0,
    );
    // usable = (10-0)% of 10kWh = 1kWh, net = 5kW
    // hours = 1/5 = 0.2h = 12min
    expect(result.minutesUntilDepletion).toBeCloseTo(12, 0);
    expect(result.thresholdPercent).toBe(0);
  });

  it('E17 should respect user-configured custom threshold of 20%', () => {
    const result = calculateDepletion(
      {
        batterySocPercent: 50,
        loadKw: 2,
        batteryCapacityKwh: 10,
        solarGenKw: 0,
        inverterRatedPowerKw: 5,
      },
      20,
    );
    // usable = (50-20)% of 10kWh = 3kWh, net = 2kW
    // hours = 3/2 = 1.5h = 90min
    expect(result.minutesUntilDepletion).toBeCloseTo(90, 0);
    expect(result.thresholdPercent).toBe(20);
  });

  it('E17b should return 0 when SOC is below custom threshold', () => {
    const result = calculateDepletion(
      {
        batterySocPercent: 15,
        loadKw: 3,
        batteryCapacityKwh: 10,
        solarGenKw: 0,
        inverterRatedPowerKw: 5,
      },
      20,
    );
    // SOC 15% < threshold 20% → already depleted
    expect(result.minutesUntilDepletion).toBe(0);
  });
});
