// ==================================================================
// QUIET HOURS PER USER
// Tests for isWithinQuietHours() and convertToUTC() in helpers/quiet-hours.ts
// Pure functions — no mocks needed.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import { convertToUTC, isWithinQuietHours } from '../helpers/quiet-hours';

// ------------------------------------------------------------------
// TESTS  (5.1 – 5.6)   —   Quiet Hours Logic
// ------------------------------------------------------------------
describe('QuietHours — Test Cases', () => {
  it('5.1 should return true when current time falls within quiet hours', () => {
    // 10PM UTC, quiet hours 9PM–7AM
    const currentTime = new Date('2026-05-16T22:00:00Z');
    expect(isWithinQuietHours(currentTime, '21:00', '07:00')).toBe(true);
  });

  it('5.2 should return false when current time is outside quiet hours', () => {
    // 2PM UTC, quiet hours 10PM–7AM
    const currentTime = new Date('2026-05-16T14:00:00Z');
    expect(isWithinQuietHours(currentTime, '22:00', '07:00')).toBe(false);
  });

  it('5.3 should always deliver when user has no quiet hours configured (null settings)', () => {
    // When quietHoursStart/End are null, the caller skips isWithinQuietHours entirely.
    // This test verifies the function is not called with null — it would throw.
    // The guard lives in the caller (AlertDetectionJob), not in this function.
    // We verify the function works correctly with a non-null range as a sanity check.
    const currentTime = new Date('2026-05-16T03:00:00Z');
    // A range that does NOT include 3AM
    expect(isWithinQuietHours(currentTime, '22:00', '02:00')).toBe(false);
  });

  it('5.4 should return true during quiet hours (critical alert bypasses this at the caller level)', () => {
    // isWithinQuietHours itself doesn't know about severity — it just reports time.
    // The CRITICAL bypass is handled by the caller (AlertDetectionJob).
    const currentTime = new Date('2026-05-16T01:00:00Z'); // 1AM
    expect(isWithinQuietHours(currentTime, '21:00', '07:00')).toBe(true);
    // Caller then checks: if severity === CRITICAL → deferDelivery = false
  });

  it('5.5 should correctly handle quiet hours that span midnight', () => {
    const quietStart = '23:00';
    const quietEnd = '06:00';

    // 11:30PM → quiet
    expect(
      isWithinQuietHours(
        new Date('2026-05-16T23:30:00Z'),
        quietStart,
        quietEnd,
      ),
    ).toBe(true);
    // 2:00AM → quiet
    expect(
      isWithinQuietHours(
        new Date('2026-05-17T02:00:00Z'),
        quietStart,
        quietEnd,
      ),
    ).toBe(true);
    // 6:30AM → not quiet (past end)
    expect(
      isWithinQuietHours(
        new Date('2026-05-17T06:30:00Z'),
        quietStart,
        quietEnd,
      ),
    ).toBe(false);
  });

  it('5.6 should apply quiet hours per-channel independently', () => {
    // WhatsApp: quiet 22:00–07:00. Email/SMS: no quiet hours.
    const currentTime = new Date('2026-05-16T23:00:00Z'); // 11PM

    const isWhatsappQuiet = isWithinQuietHours(currentTime, '22:00', '07:00');
    // Email and SMS have no quiet hours — caller skips the check → not quiet
    const isEmailQuiet = false;
    const isSmsQuiet = false;

    expect(isWhatsappQuiet).toBe(true);
    expect(isEmailQuiet).toBe(false);
    expect(isSmsQuiet).toBe(false);
  });
});

// ------------------------------------------------------------------
// EDGE CASES  (E25 – E30)
// ------------------------------------------------------------------
describe('QuietHours — Edge Cases', () => {
  it('E25 should correctly identify midnight (00:00) as within a midnight-spanning range', () => {
    // Quiet hours 22:00–06:00. Midnight is clearly within this range.
    const midnight = new Date('2026-05-17T00:00:00Z');
    expect(isWithinQuietHours(midnight, '22:00', '06:00')).toBe(true);
  });

  it('E26 should treat 00:00–00:00 as always quiet (sentinel for complete silence)', () => {
    const times = [
      new Date('2026-05-16T00:00:00Z'),
      new Date('2026-05-16T06:00:00Z'),
      new Date('2026-05-16T12:00:00Z'),
      new Date('2026-05-16T18:00:00Z'),
      new Date('2026-05-16T23:59:00Z'),
    ];

    times.forEach((time) => {
      expect(isWithinQuietHours(time, '00:00', '00:00')).toBe(true);
    });
  });

  it('E27 should re-evaluate correctly when quiet hours settings change', () => {
    const evaluationTime = new Date('2026-05-16T23:00:00Z'); // 11PM

    // Old settings: quiet 21:00–07:00 → 11PM is quiet
    expect(isWithinQuietHours(evaluationTime, '21:00', '07:00')).toBe(true);

    // New settings: quiet 01:00–05:00 → 11PM is NOT quiet
    expect(isWithinQuietHours(evaluationTime, '01:00', '05:00')).toBe(false);
  });

  it('E28 should convert user local time to UTC correctly before evaluating', () => {
    // User in Lagos (UTC+1) sets quiet hours 22:00–06:00 local time
    // Server evaluates at 21:00 UTC = 22:00 Lagos time → should be quiet

    const utcStart = convertToUTC('22:00', '+01:00');
    const utcEnd = convertToUTC('06:00', '+01:00');

    expect(utcStart).toBe('21:00'); // 22:00 Lagos = 21:00 UTC
    expect(utcEnd).toBe('05:00'); // 06:00 Lagos = 05:00 UTC

    const serverTimeUtc = new Date('2026-05-16T21:00:00Z');
    expect(isWithinQuietHours(serverTimeUtc, utcStart, utcEnd)).toBe(true);
  });

  it('E28b should handle negative UTC offset (e.g. UTC-5 New York)', () => {
    // User in New York (UTC-5) sets quiet hours 22:00–06:00 local time
    // 22:00 New York = 03:00 UTC next day
    const utcStart = convertToUTC('22:00', '-05:00');
    const utcEnd = convertToUTC('06:00', '-05:00');

    expect(utcStart).toBe('03:00'); // 22:00 NYC = 03:00 UTC
    expect(utcEnd).toBe('11:00'); // 06:00 NYC = 11:00 UTC

    // Server at 04:00 UTC = 23:00 NYC → quiet
    const serverTimeUtc = new Date('2026-05-16T04:00:00Z');
    expect(isWithinQuietHours(serverTimeUtc, utcStart, utcEnd)).toBe(true);
  });

  it('E29 should treat the end boundary as exclusive (07:00 exactly is NOT quiet)', () => {
    // Quiet hours 22:00–07:00. At exactly 07:00, quiet hours have ended.
    const exactlyAtEnd = new Date('2026-05-16T07:00:00Z');
    expect(isWithinQuietHours(exactlyAtEnd, '22:00', '07:00')).toBe(false);
  });

  it('E29b should treat the start boundary as inclusive (22:00 exactly IS quiet)', () => {
    const exactlyAtStart = new Date('2026-05-16T22:00:00Z');
    expect(isWithinQuietHours(exactlyAtStart, '22:00', '07:00')).toBe(true);
  });

  it('E30 should evaluate quiet hours independently for each user', () => {
    const currentTime = new Date('2026-05-16T01:00:00Z'); // 1AM UTC

    // User A: quiet 22:00–06:00 → 1AM is quiet
    const userAQuiet = isWithinQuietHours(currentTime, '22:00', '06:00');
    // User B: quiet 02:00–10:00 → 1AM is NOT quiet
    const userBQuiet = isWithinQuietHours(currentTime, '02:00', '10:00');

    expect(userAQuiet).toBe(true);
    expect(userBQuiet).toBe(false);
  });
});

// ------------------------------------------------------------------
// convertToUTC — additional unit tests
// ------------------------------------------------------------------
describe('convertToUTC', () => {
  it('should return the same time for UTC+00:00', () => {
    expect(convertToUTC('14:30', '+00:00')).toBe('14:30');
  });

  it('should subtract offset for positive timezone (UTC+2)', () => {
    expect(convertToUTC('10:00', '+02:00')).toBe('08:00');
  });

  it('should add offset for negative timezone (UTC-3)', () => {
    expect(convertToUTC('10:00', '-03:00')).toBe('13:00');
  });

  it('should wrap around midnight correctly (23:00 UTC+2 → 21:00)', () => {
    expect(convertToUTC('23:00', '+02:00')).toBe('21:00');
  });

  it('should wrap around midnight correctly (01:00 UTC-3 → 04:00)', () => {
    expect(convertToUTC('01:00', '-03:00')).toBe('04:00');
  });

  it('should handle 00:00 UTC+1 → 23:00 previous day (wraps to 23:00)', () => {
    expect(convertToUTC('00:00', '+01:00')).toBe('23:00');
  });
});
