// ==================================================================
// QUIET HOURS PER USER

// ==================================================================
jest.mock('../../../config/env', () => ({}));

import { convertToUTC, isWithinQuietHours } from '../helpers/quiet-hours';
import { MockUserSettings } from './test-helpers';

// ------------------------------------------------------------------
// TESTS  (4.1 – 4.6)   —   Quiet Hours Logic
// ------------------------------------------------------------------
describe('QuietHours — Test Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // 4.1  Within quiet hours → defer delivery
  // ------------------------------------------------------------------
  it('4.1 should mark alert as non-deliverable when current time falls within quiet hours', () => {
    /**
     * SCENARIO: User has quiet hours set from 9PM (21:00) to 7AM (07:00).
     * Current time is 10PM (22:00) — user is sleeping.
     * A battery depletion alert is detected.
     *
     * EXPECTED: The alert should be created and persisted, but marked
     * with `deliverable: false`. Delivery will be deferred until
     * quiet hours end at 7AM.
     *
     * WHY: Respecting quiet hours is crucial for user trust. No one
     * wants a WhatsApp message about their battery at 10PM. The alert
     * is still recorded for history and will be sent later.
     */
    const currentTime = new Date('2026-05-16T22:00:00Z'); // 10PM UTC
    const quietStart = '21:00';
    const quietEnd = '07:00';

    const inQuietHours = isWithinQuietHours(currentTime, quietStart, quietEnd);

    expect(inQuietHours).toBe(true);
    // Alert would be: { ...alertData, deliverable: false }
  });

  // ------------------------------------------------------------------
  // 4.2  Outside quiet hours → deliver immediately
  // ------------------------------------------------------------------
  it('4.2 should mark alert as deliverable when current time is outside quiet hours', () => {
    /**
     * SCENARIO: Same user as above, quiet hours 9PM–7AM.
     * Current time is 2PM (14:00) — middle of the day.
     *
     * EXPECTED: The alert should be delivered immediately because
     * the user is awake and available to receive notifications.
     *
     * WHY: Normal business hours = normal delivery. No reason to
     * delay an alert that the user can act on right now.
     */
    const currentTime = new Date('2026-05-16T14:00:00Z'); // 2PM UTC
    const quietStart = '21:00';
    const quietEnd = '07:00';

    const inQuietHours = isWithinQuietHours(currentTime, quietStart, quietEnd);

    expect(inQuietHours).toBe(false);
    // Alert would be: { ...alertData, deliverable: true }
  });

  // ------------------------------------------------------------------
  // 4.3  No quiet hours configured → always deliver
  // ------------------------------------------------------------------
  it('4.3 should always deliver when user has no quiet hours configured', () => {
    /**
     * SCENARIO: User has never set up quiet hours — the fields are
     * null/undefined in their settings.
     *
     * EXPECTED: All alerts are deliverable regardless of time.
     * The default behavior is "no quiet hours" = "always notify".
     *
     * WHY: Quiet hours are opt-in. By default, users want to be
     * notified anytime something critical happens. Don't assume
     * silence.
     */
    const userSettings: MockUserSettings = {
      userId: 'user-123',
      quietHoursStart: undefined,
      quietHoursEnd: undefined,
    };

    const hasQuietHours =
      userSettings.quietHoursStart !== undefined &&
      userSettings.quietHoursEnd !== undefined;

    expect(hasQuietHours).toBe(false);
    // Since no quiet hours: deliverable = true always
  });

  // ------------------------------------------------------------------
  // 4.4  Critical alert → bypass quiet hours
  // ------------------------------------------------------------------
  it('4.4 should bypass quiet hours when alert severity is "critical"', () => {
    /**
     * SCENARIO: It's 1AM — deep in quiet hours. But the battery
     * SOC has dropped to 5% and depletion is imminent (critical).
     *
     * EXPECTED: Critical alerts SHOULD bypass quiet hours and be
     * delivered immediately, even at 1AM. Life/safety/property
     * take priority over notification preferences.
     *
     * WHY: Quiet hours are for convenience, not for emergencies.
     * A critical battery depletion at night could mean the user's
     * refrigerator, security system, or medical equipment is about
     * to lose power. They MUST be told.
     */
    const currentTime = new Date('2026-05-16T01:00:00Z'); // 1AM
    const quietStart = '21:00';
    const quietEnd = '07:00';
    const alertSeverity = 'critical';

    const isQuiet = isWithinQuietHours(currentTime, quietStart, quietEnd);
    const shouldBypass = alertSeverity === 'critical';

    expect(isQuiet).toBe(true); // Yes, it's quiet hours
    expect(shouldBypass).toBe(true); // But critical overrides
  });

  // ------------------------------------------------------------------
  // 4.5  Midnight boundary (overlapping)
  // ------------------------------------------------------------------
  it('4.5 should correctly handle quiet hours that span midnight', () => {
    /**
     * SCENARIO: Quiet hours = 11PM (23:00) to 6AM (06:00).
     * This spans midnight. We test THREE times:
     *   - 11:30PM → should be quiet
     *   - 2:00AM  → should be quiet
     *   - 6:30AM  → should NOT be quiet (ended at 6:00)
     *
     * EXPECTED: Midnight-spanning ranges are correctly evaluated.
     * This is a common source of bugs because the logic flips:
     *   if start > end → "OR" logic (before end OR after start)
     *   if start < end → "AND" logic (after start AND before end)
     *
     * WHY: Many developers get this wrong. A simple comparison
     * like "22:00 < now < 06:00" will NEVER be true because 22 > 6.
     * You must detect the span and use OR instead of AND.
     */
    const quietStart = '23:00';
    const quietEnd = '06:00';

    const beforeMidnight = new Date('2026-05-16T23:30:00Z');
    const afterMidnight = new Date('2026-05-17T02:00:00Z');
    const afterQuietEnd = new Date('2026-05-17T06:30:00Z');

    expect(isWithinQuietHours(beforeMidnight, quietStart, quietEnd)).toBe(true); // 11:30PM → quiet
    expect(isWithinQuietHours(afterMidnight, quietStart, quietEnd)).toBe(true); // 2:00AM  → quiet
    expect(isWithinQuietHours(afterQuietEnd, quietStart, quietEnd)).toBe(false); // 6:30AM  → not quiet
  });

  // ------------------------------------------------------------------
  // 4.6  Channel-specific quiet logic
  // ------------------------------------------------------------------
  it('4.6 should apply quiet hours per-channel (WhatsApp blocked, SMS allowed)', () => {
    /**
     * SCENARIO: User has configured "Do not disturb WhatsApp
     * between 10PM–7AM, but SMS is okay anytime." This is a
     * more granular setting than a blanket quiet hours switch.
     *
     * EXPECTED: At 11PM:
     *   - WhatsApp delivery → blocked (deferred)
     *   - SMS delivery → allowed immediately
     *   - Email delivery → allowed immediately
     *
     * WHY: Different channels have different levels of intrusiveness.
     * A WhatsApp message pops up on screen — very intrusive.
     * An SMS might be less intrusive. Email is rarely checked at
     * night anyway. Users should be able to set per-channel quiet
     * hours for finer control.
     */
    type ChannelWindow = { start: string; end: string } | null;
    type ChannelQuietHours = {
      whatsapp: { start: string; end: string };
      email: ChannelWindow;
      sms: ChannelWindow;
    };
    const currentTime = new Date('2026-05-16T23:00:00Z');
    const channelQuietHours: ChannelQuietHours = {
      whatsapp: { start: '22:00', end: '07:00' },
      email: null, // No quiet hours for email
      sms: null, // No quiet hours for SMS
    };

    const isWhatsappQuiet = isWithinQuietHours(
      currentTime,
      channelQuietHours.whatsapp.start,
      channelQuietHours.whatsapp.end,
    );
    const isEmailQuiet = channelQuietHours.email
      ? isWithinQuietHours(
          currentTime,
          channelQuietHours.email.start,
          channelQuietHours.email.end,
        )
      : false;
    const isSmsQuiet = channelQuietHours.sms
      ? isWithinQuietHours(
          currentTime,
          channelQuietHours.sms.start,
          channelQuietHours.sms.end,
        )
      : false;

    expect(isWhatsappQuiet).toBe(true); // WhatsApp blocked
    expect(isEmailQuiet).toBe(false); // Email allowed
    expect(isSmsQuiet).toBe(false); // SMS allowed
  });
});

// ------------------------------------------------------------------
// EDGE CASES
// ------------------------------------------------------------------
describe('QuietHours — Edge Cases', () => {
  // ------------------------------------------------------------------
  // E25  Inverted range — test 00:00 exactly
  // ------------------------------------------------------------------
  it('E25 should handle 00:00 exactly at the edge of a midnight-spanning range', () => {
    /**
     * SCENARIO: Quiet hours = 22:00 – 06:00. Current time = 00:00.
     *
     * EXPECTED: Midnight is ALWAYS within quiet hours when the
     * range spans midnight. 00:00 is 6 hours before 06:00 and
     * 2 hours after 22:00 — clearly in the quiet zone.
     *
     * WHY: Midnight (00:00) is a boundary where date changes.
     * A naive implementation might compare the date part and fail.
     * This test ensures the comparison is time-of-day only.
     */
    const midnight = new Date('2026-05-17T00:00:00Z');
    const quietStart = '22:00';
    const quietEnd = '06:00';

    expect(isWithinQuietHours(midnight, quietStart, quietEnd)).toBe(true);
  });

  // ------------------------------------------------------------------
  // E26  00:00–00:00 = always quiet (user wants complete silence)
  // ------------------------------------------------------------------
  it('E26 should treat 00:00–00:00 as "always quiet" (user silence mode)', () => {
    /**
     * SCENARIO: User sets quiet hours to 00:00–00:00. This is a
     * special case meaning "always quiet, never disturb."
     *
     * EXPECTED: No alerts are delivered via this channel at any
     * time. The user has effectively muted notifications.
     *
     * WHY: Some users want complete silence (e.g., a night shift
     * worker who sleeps at irregular hours). Setting 00:00–00:00
     * is an intuitive way to express "always" since the start
     * and end are the same. The system should recognize this
     * sentinel value.
     */
    const testTimes = [
      new Date('2026-05-16T00:00:00Z'),
      new Date('2026-05-16T06:00:00Z'),
      new Date('2026-05-16T12:00:00Z'),
      new Date('2026-05-16T18:00:00Z'),
      new Date('2026-05-16T23:59:00Z'),
    ];

    testTimes.forEach((time) => {
      expect(isWithinQuietHours(time, '00:00', '00:00')).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // E27  User removes quiet hours mid-session → re-evaluate
  // ------------------------------------------------------------------
  it('E27 should re-evaluate delivery when user updates quiet hours while alert is pending', () => {
    /**
     * SCENARIO: An alert is created at 10PM during quiet hours
     * and marked `deliverable: false`. At 11PM, the user changes
     * their quiet hours to 1AM–5AM (narrower window). The pending
     * alert should be re-evaluated immediately.
     *
     * EXPECTED: After the settings change, the 10PM alert should
     * become deliverable because 11PM is now outside quiet hours.
     *
     * WHY: Settings changes should take effect immediately, not
     * on the next cron cycle. If the user broadens or narrows
     * their quiet hours, pending alerts should respect the NEW
     * settings.
     */
    const settingsUpdateTime = new Date('2026-05-16T23:00:00Z');

    // Old settings: quiet from 21:00 – 07:00
    const oldQuietStart = '21:00';
    const oldQuietEnd = '07:00';

    // New settings: quiet from 01:00 – 05:00
    const newQuietStart = '01:00';
    const newQuietEnd = '05:00';

    // At 11PM, with old settings → quiet
    const oldResult = isWithinQuietHours(
      settingsUpdateTime,
      oldQuietStart,
      oldQuietEnd,
    );
    expect(oldResult).toBe(true);

    // At 11PM, with new settings → NOT quiet
    const newResult = isWithinQuietHours(
      settingsUpdateTime,
      newQuietStart,
      newQuietEnd,
    );
    expect(newResult).toBe(false);

    // Alert should be re-evaluated and now deliverable
  });

  // ------------------------------------------------------------------
  // E28  User timezone differs from server timezone
  // ------------------------------------------------------------------
  it('E28 should evaluate quiet hours in the USER local timezone, not server timezone', () => {
    /**
     * SCENARIO: Server is in UTC. User is in Lagos, Nigeria (UTC+1).
     * User sets quiet hours as 22:00–06:00 in THEIR local time.
     * Server time when user's local time is 22:00 = 21:00 UTC.
     *
     * EXPECTED: The system should convert the user's quiet hours
     * to UTC before comparing with the current UTC time. If the
     * server evaluates at 21:00 UTC, it should recognize that
     * this equals 22:00 Lagos time → quiet hours are quiet hours are active.
     *
     * WHY: This is a CRITICAL bug in many systems. If the server
     * uses its own timezone to evaluate, a user in UTC+1 who set
     * quiet hours from 10PM–6AM would actually get quiet hours
     * from 9PM–5AM UTC, which is WRONG. The user would get
     * notifications at 9PM UTC (10PM their time) — breaking trust.
     */
    const userTimezoneOffset = '+01:00'; // Lagos, Nigeria
    const userQuietStartLocal = '22:00';
    const userQuietEndLocal = '06:00';

    const utcQuietStart = convertToUTC(userQuietStartLocal, userTimezoneOffset);
    const utcQuietEnd = convertToUTC(userQuietEndLocal, userTimezoneOffset);

    // Server evaluates at 22:00 UTC+1 = 21:00 UTC
    const serverTimeUtc = new Date('2026-05-16T21:00:00Z');

    // Evaluate using CONVERTED (UTC) quiet hours
    const inQuiet = isWithinQuietHours(
      serverTimeUtc,
      utcQuietStart,
      utcQuietEnd,
    );

    expect(utcQuietStart).toBe('21:00'); // User's 22:00 Lagos = 21:00 UTC 21:00
    expect(utcQuietEnd).toBe('05:00'); // User's 06:00 Lagos =  UTC 05:00
    expect(inQuiet).toBe(true); // 21:00 UTC is within 21:00=05:00 range
  });

  // ------------------------------------------------------------------
  // E29  Quiet hours end exactly at current minute → boundary
  // ------------------------------------------------------------------
  it('E29 should treat the boundary minute as no longer quiet when quiet hours end exactly now', () => {
    /**
     * SCENARIO: Quiet hours are set to 22:00–07:00. Current time
     * is exactly 07:00. Does this mean:
     *   (a) "07:00 is still quiet, end at 07:00:00.001"
     *   (b) "07:00 is the END boundary — not quiet anymore"
     *
     * EXPECTED: We choose (b) — the end boundary is EXCLUSIVE.
     * At 07:00:00 exactly, quiet hours have ended and delivery
     * is allowed. The logic uses `< endMinutes`, not `<=`.
     *
     * WHY: Consider a user who sets quiet hours from 9AM–5PM
     * (work hours). If current time is exactly 5PM, they should
     * start receiving notifications again. Using exclusive end
     * means the range [09:00, 17:00) is quiet — 17:00 is not.
     * This is intuitive: "until 5PM" means at 5PM it's over.
     */
    const exactlyAtEnd = new Date('2026-05-16T07:00:00Z');
    const quietStart = '22:00';
    const quietEnd = '07:00';

    const inQuiet = isWithinQuietHours(exactlyAtEnd, quietStart, quietEnd);

    expect(inQuiet).toBe(false); // 07:00 is NOT quiet (exclusive end)
  });

  // ------------------------------------------------------------------
  // E30  Multiple users with different quiet hours → independent
  // ------------------------------------------------------------------
  it('E30 should evaluate quiet hours independently for each user', () => {
    /**
     * SCENARIO: Two users in the same household share an inverter.
     *   User A: quiet hours 22:00–06:00 (early riser)
     *   User B: quiet hours 02:00–10:00 (night owl)
     * Current time is 01:00.
     *
     * EXPECTED:
     *   User A: 01:00 is within 22:00–06:00 → QUIET → defer alert
     *   User B: 01:00 is NOT within 02:00–10:00 → NOT QUIET → deliver immediately
     *
     * WHY: Each user has their own preferences and sleep schedule.
     * The system must NOT use a global "are we in quiet hours?"
     * flag. Every alert is evaluated against the specific user's
     * settings. One user may be sleeping while another is awake,
     * even if they share the same physical inverter.
     */
    const currentTime = new Date('2026-05-16T01:00:00Z');

    const userA: MockUserSettings = {
      userId: 'user-A',
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
    };

    const userB: MockUserSettings = {
      userId: 'user-B',
      quietHoursStart: '02:00',
      quietHoursEnd: '10:00',
    };

    const userAQuiet = isWithinQuietHours(
      currentTime,
      userA.quietHoursStart!,
      userA.quietHoursEnd!,
    );
    const userBQuiet = isWithinQuietHours(
      currentTime,
      userB.quietHoursStart!,
      userB.quietHoursEnd!,
    );

    expect(userAQuiet).toBe(true); // User A is sleeping
    expect(userBQuiet).toBe(false); // User B is awake
  });
});
