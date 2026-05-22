import { computeHealthStatus } from '../helpers/health-status.helper';

/**
 * Unit tests for computeHealthStatus — covers all ticket requirements:
 *   - All three active states (GREEN, AMBER, RED)
 *   - GREY for offline
 *   - Boundary at exactly 20% SoC (ticket threshold; our default is 15/30 but
 *     tests pass explicit thresholds to match ticket spec)
 *   - Boundary at exactly 30% below expected solar
 *   - RED + AMBER simultaneous case (RED takes precedence)
 *   - NULL SoC edge case
 *   - Offline + high battery edge case
 *   - Time-of-day gating for solar checks
 */
describe('computeHealthStatus', () => {
  // Use ticket-specified thresholds (20% critical) for boundary tests
  const ticketThresholds = {
    criticalSocThreshold: 20,
    lowSocThreshold: 30,
  };

  const DAYTIME = 12; // noon — solar checks active
  const NIGHTTIME = 22; // 10pm — solar checks suppressed

  // ── GREEN ─────────────────────────────────────────────────────────────────

  describe('GREEN', () => {
    it('returns GREEN when battery is healthy and solar is adequate', () => {
      const result = computeHealthStatus({
        socPercent: 80,
        solarKw: 5,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREEN');
      expect(result.reason).toBe('System operating normally');
    });

    it('returns GREEN when battery is above threshold and solar is exactly at 30% of capacity', () => {
      // Boundary: solarKw === panelCapacityKw * 0.3 is NOT below threshold
      const result = computeHealthStatus({
        socPercent: 50,
        solarKw: 3, // exactly 30% of 10 kW
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREEN');
    });

    it('returns GREEN at night even when solar is zero (no penalty outside daytime)', () => {
      const result = computeHealthStatus({
        socPercent: 60,
        solarKw: 0,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: NIGHTTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREEN');
    });
  });

  // ── AMBER ─────────────────────────────────────────────────────────────────

  describe('AMBER', () => {
    it('returns AMBER when solar is more than 30% below expected during daytime', () => {
      const result = computeHealthStatus({
        socPercent: 80,
        solarKw: 2, // 20% of 10 kW — below 30% threshold
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('AMBER');
      expect(result.reason).toContain('30%');
    });

    it('returns AMBER when battery is low but above critical threshold', () => {
      const result = computeHealthStatus({
        socPercent: 25, // between 20% critical and 30% low
        solarKw: 5,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('AMBER');
      expect(result.reason).toContain('low');
    });

    it('returns AMBER when both battery is low and solar is weak (combined reason)', () => {
      const result = computeHealthStatus({
        socPercent: 25,
        solarKw: 2,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('AMBER');
      expect(result.reason).toContain('low');
      expect(result.reason).toContain('30%');
    });
  });

  // ── RED ───────────────────────────────────────────────────────────────────

  describe('RED', () => {
    it('returns RED when battery SoC is at or below critical threshold', () => {
      const result = computeHealthStatus({
        socPercent: 20, // exactly at ticket threshold
        solarKw: 5,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('RED');
    });

    it('returns RED when battery SoC is below critical threshold', () => {
      const result = computeHealthStatus({
        socPercent: 10,
        solarKw: 5,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('RED');
    });

    it('returns RED when battery is low and solar is zero during daytime (no recovery path)', () => {
      const result = computeHealthStatus({
        socPercent: 25,
        solarKw: 0,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('RED');
      expect(result.reason).toContain('no solar generation');
    });

    it('returns RED when SoC is null (battery data unavailable)', () => {
      const result = computeHealthStatus({
        socPercent: null,
        solarKw: 5,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('RED');
      expect(result.reason).toBe('Battery data unavailable');
    });
  });

  // ── GREY ──────────────────────────────────────────────────────────────────

  describe('GREY', () => {
    it('returns GREY when system is offline regardless of battery level', () => {
      const result = computeHealthStatus({
        socPercent: 80, // high battery — should NOT override offline
        solarKw: 5,
        panelCapacityKw: 10,
        systemOffline: true,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREY');
    });

    it('returns GREY when system is offline even with null SoC', () => {
      const result = computeHealthStatus({
        socPercent: null,
        solarKw: 0,
        panelCapacityKw: 10,
        systemOffline: true,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREY');
    });
  });

  // ── Precedence ────────────────────────────────────────────────────────────

  describe('precedence', () => {
    it('RED takes precedence over AMBER when both conditions are simultaneously true', () => {
      // SoC at critical (RED) AND solar is weak (AMBER) — RED must win
      const result = computeHealthStatus({
        socPercent: 20, // at critical threshold → RED
        solarKw: 1, // below 30% of capacity → AMBER
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('RED');
    });

    it('GREY takes precedence over RED when system is offline with critical battery', () => {
      const result = computeHealthStatus({
        socPercent: 5,
        solarKw: 0,
        panelCapacityKw: 10,
        systemOffline: true,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREY');
    });
  });

  // ── Boundary conditions ───────────────────────────────────────────────────

  describe('boundary conditions', () => {
    it('SoC at exactly 21% (one above critical) is not RED from SoC alone', () => {
      const result = computeHealthStatus({
        socPercent: 21,
        solarKw: 5,
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      // 21% is above critical (20%) but below low (30%) → AMBER
      expect(result.status).toBe('AMBER');
    });

    it('solar at exactly 30% of capacity is not flagged as low', () => {
      const result = computeHealthStatus({
        socPercent: 80,
        solarKw: 3, // exactly 30% of 10 kW
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREEN');
    });

    it('solar at 29.9% of capacity is flagged as low', () => {
      const result = computeHealthStatus({
        socPercent: 80,
        solarKw: 2.99, // just below 30% of 10 kW
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: DAYTIME,
        ...ticketThresholds,
      });
      expect(result.status).toBe('AMBER');
    });

    it('solar check is suppressed at night (hour 19 is boundary — nighttime)', () => {
      const result = computeHealthStatus({
        socPercent: 80,
        solarKw: 0, // zero solar — would be AMBER/RED during day
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: 19, // boundary: SOLAR_DAYTIME_END_HOUR — nighttime
        ...ticketThresholds,
      });
      expect(result.status).toBe('GREEN');
    });

    it('solar check is active at hour 6 (daytime boundary start)', () => {
      const result = computeHealthStatus({
        socPercent: 80,
        solarKw: 1, // below 30% of 10 kW
        panelCapacityKw: 10,
        systemOffline: false,
        localHour: 6, // boundary: SOLAR_DAYTIME_START_HOUR — daytime
        ...ticketThresholds,
      });
      expect(result.status).toBe('AMBER');
    });
  });
});
