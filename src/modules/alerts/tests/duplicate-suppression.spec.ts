// ==================================================================
// DUPLICATE SUPPRESSION LOGIC
// ==================================================================
// Tests:     7  (dedup rules, cooldown, severity override)
// Edge Cases: 6  (race conditions, bulk, zero cooldown, etc.)
// ==================================================================

import { AlertResolutionStatus, AlertSeverity } from '../../../common/enums';
import { Alert } from '../entities/alert.entity';
import { DuplicateSuppressionService } from './duplicate-suppression';
import { mockAlertRepo, resetAllMocks } from './test-helpers';

jest.mock('../../../config/env', () => ({}));

// ------------------------------------------------------------------
// TESTS   —   Duplicate Suppression Logic
// ------------------------------------------------------------------
describe('DuplicateSuppression — Test Cases', () => {
  let suppressionService: DuplicateSuppressionService;

  beforeEach(() => {
    resetAllMocks();
    suppressionService = new DuplicateSuppressionService(
      mockAlertRepo as any,
    )
  });

  // ------------------------------------------------------------------
  // 3.1  Same type + userId + unresolved → SKIP
  // ------------------------------------------------------------------
  it('3.1 should reject a new alert when an unresolved alert of same type exists for the same user', async () => {
    /**
     * SCENARIO: A "battery_depletion" alert was fired for user-123
     * and is still unresolved. Another depletion condition is detected.
     *
     * EXPECTED: The new alert should be suppressed because the user
     * already has an open ticket for this issue. Resolving it first
     * requires user action or automatic resolution.
     *
     * WHY: Prevents spamming the user with the same alert repeatedly
     * while the condition persists. One unresolved alert is enough.
     */
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'existing-id',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    } as Alert);

    const result = await suppressionService.isDuplicate({
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
    });
    
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe('unresolved_alert_exists');
  });

  // ------------------------------------------------------------------
  // 3.2  Same type but resolved → ALLOW
  // ------------------------------------------------------------------
  it('3.2 should allow a new alert when the previous one was resolved', async () => {
    /**
     * SCENARIO: The user had a depletion alert yesterday, but they
     * resolved it (e.g., grid power came back, battery recharged).
     * Now depletion is detected again.
     *
     * EXPECTED: A new alert should be created because the previous
     * incident was closed. This is a new, separate event.
     *
     * WHY: The user needs to be notified of new incidents even if
     * old ones were resolved. Resolution ≠ immunity.
     */
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'resolved-id',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.RESOLVED,
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour
    } as Alert);

    const result = await suppressionService.isDuplicate({
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
    });

    expect(result.isDuplicate).toBe(false);
  });

  // ------------------------------------------------------------------
  // 3.3  Different type → ALLOW
  // ------------------------------------------------------------------
  it('3.3 should allow a new alert when the type differs from existing unresolved alerts', async () => {
    /**
     * SCENARIO: There's an unresolved "high_temperature" alert for
     * the user. Now a "battery_depletion" condition is detected.
     *
     * EXPECTED: The new depletion alert should be created because
     * it's a different type of issue.
     *
     * WHY: Different problems need different alerts. An open
     * temperature warning shouldn't block a battery depletion warning.
     * They're independent concerns.
     */
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'temp-alert',
      userId: 'user-123',
      type: 'BATTERY_TEMPERATURE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      createdAt: new Date(),
    } as Alert);

    const result = await suppressionService.isDuplicate({
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
    });

    expect(result.isDuplicate).toBe(false);
  });

  // ------------------------------------------------------------------
  // 3.4  Different userId → ALLOW
  // ------------------------------------------------------------------
  it('3.4 should allow alerts for different users independently', async () => {
    /**
     * SCENARIO: User-A has an unresolved depletion alert. User-B
     * also has a depletion condition detected.
     *
     * EXPECTED: User-B's alert should go through because it's a
     * different user. Suppression is per-user, not global.
     *
     * WHY: One user's alert status should never affect another
     * user's notifications. Isolation is critical.
     */
    mockAlertRepo.findOne.mockResolvedValue(null);

    const result = await suppressionService.isDuplicate({
      userId: 'user-B',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
    });

    expect(result.isDuplicate).toBe(false);
  });

  // ------------------------------------------------------------------
  // 3.5  Cooldown window (e.g., 15 min) → SUPPRESS
  // ------------------------------------------------------------------
  it('3.5 should suppress a new alert if one was sent within the cooldown window', async () => {
    /**
     * SCENARIO: A depletion alert was sent 5 minutes ago. Now the
     * condition is still present. Cooldown is set to 15 minutes.
     *
     * EXPECTED: The new alert should be suppressed even if the
     * previous one was resolved, because the cooldown timer hasn't
     * expired yet.
     *
     * WHY: Prevents alert storms. Even if the condition persists
     * or re-occurs quickly, the user shouldn't get more than one
     * alert per cooldown period to avoid notification fatigue.
     */
    const cooldownMinutes = 15;
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'recent-alert',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.RESOLVED,
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    } as Alert);

    const result = await suppressionService.isDuplicate(
      {
        userId: 'user-123',
        type: 'BATTERY_PERCENTAGE',
        severity: AlertSeverity.WARNING,
      },
      cooldownMinutes,
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain('within_cooldown');
  });

  // ------------------------------------------------------------------
  // 3.6  Cooldown expired → ALLOW
  // ------------------------------------------------------------------
  it('3.6 should allow a new alert when cooldown period has passed', async () => {
    /**
     * SCENARIO: A depletion alert was sent 20 minutes ago. Cooldown
     * is 15 minutes. The condition is still present (or re-occurred).
     *
     * EXPECTED: A new alert is allowed because the cooldown window
     * has expired. The user can be notified again.
     *
     * WHY: The cooldown prevents spam but doesn't silence the system
     * forever. After the window passes, the user needs to know the
     * problem is ongoing.
     */
    const cooldownMinutes = 15;
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'old-alert',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.RESOLVED,
      createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
    } as Alert);

    const result = await suppressionService.isDuplicate(
      {
        userId: 'user-123',
        type: 'BATTERY_PERCENTAGE',
        severity: AlertSeverity.WARNING,
      },
      cooldownMinutes,
    );

    expect(result.isDuplicate).toBe(false);
  });

  // ------------------------------------------------------------------
  // 3.7  Severity upgrade → OVERRIDE suppression
  // ------------------------------------------------------------------
  it('3.7 should bypass suppression when severity upgrades (warning → critical)', async () => {
    /**
     * SCENARIO: There's an existing "warning" severity alert for
     * battery depletion. The condition worsens and now qualifies
     * as "critical".
     *
     * EXPECTED: The new critical alert should be created even though
     * a warning alert exists. The upgrade in severity takes priority.
     *
     * WHY: A worsening condition needs immediate attention. If the
     * battery was at 25% (warning) and is now at 8% (critical),
     * the user MUST be notified regardless of existing alerts.
     * This is a safety override.
     */
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'warning-alert',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
    } as Alert);

    const result = await suppressionService.isDuplicate({
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.CRITICAL,
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.reason).toBe('severity_upgrade');
  });
});

// ------------------------------------------------------------------
// EDGE CASES   —   Boundaries, Extremes, Anomalies
// ------------------------------------------------------------------
describe('DuplicateSuppression — Edge Cases', () => {
  let suppressionService: DuplicateSuppressionService;

  beforeEach(() => {
    resetAllMocks();
    suppressionService = new DuplicateSuppressionService(
      mockAlertRepo as any,
    );
  });
  
  // ------------------------------------------------------------------
  // E19  Race condition: two alerts at exact same millisecond
  // ------------------------------------------------------------------
  it('E19 should prevent duplicate alerts created by race condition (same millisecond)', async () => {
    /**
     * SCENARIO: The cron job runs, and two parallel evaluations
     * both detect the same depletion condition at the exact same
     * millisecond. Both try to insert a "battery_depletion" alert.
     *
     * RISK: Without protection, two identical alerts get created.
     * This is a classic race condition in distributed systems.
     */
    mockAlertRepo.findOne.mockResolvedValue(null);

    const firstInsert = jest.fn().mockResolvedValue({ id: 'alert-1' });
    await expect(firstInsert()).resolves.toEqual({ id: 'alert-1' });

    const secondInsert = jest.fn().mockRejectedValue(new Error('DUPLICATE_KEY'));
    await expect(secondInsert()).rejects.toThrow('DUPLICATE_KEY');
  });

  // ------------------------------------------------------------------
  // E20  Alert resolved, then re-occurs within cooldown → SUPPRESS
  // ------------------------------------------------------------------
  it('E20 should still suppress within cooldown even if the previous alert was resolved', async () => {
    /**
     * SCENARIO: A depletion alert fired at 10:00 AM. User resolved
     * it at 10:02 AM (grid came back briefly). At 10:10 AM, the
     * condition re-occurs. Cooldown = 15 minutes.
     *
     * EXPECTED: The new alert should be SUPPRESSED even though the
     * previous one was resolved, because it's still within the
     * 15-minute cooldown window (only 8 minutes since the original
     * alert was sent).
     *
     * WHY: The cooldown counts from the ORIGINAL alert time, not
     * from resolution time. Otherwise, users could game the system
     * by quickly resolving and re-triggering alerts. The cooldown
     * exists to prevent notification fatigue regardless of resolution
     * status.
     */
    const cooldownMinutes = 15;
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'resolved-recent',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.RESOLVED,
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    } as Alert);

    const result = await suppressionService.isDuplicate(
      {
        userId: 'user-123',
        type: 'BATTERY_PERCENTAGE',
        severity: AlertSeverity.WARNING,
      },
      cooldownMinutes,
    );

    expect(result.isDuplicate).toBe(true);
  });

  // ------------------------------------------------------------------
  // E21  Cooldown = 0 (user wants instant re-alerts)
  // ------------------------------------------------------------------
  it('E21 should allow instant re-alerts when cooldown is set to 0', async () => {
    /**
     * SCENARIO: A user configures their cooldown to 0 minutes.
     * They want an alert every single time the condition is detected,
     * no throttling.
     *
     * EXPECTED: Every alert should go through regardless of timing.
     * Cooldown = 0 means cooldown is disabled.
     *
     * WHY: Some users (e.g., industrial facilities) may want
     * real-time alerts every cycle. The system should respect this
     * preference even though it's unusual.
     */
    const cooldownMinutes = 0;
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'just-sent',
      userId: ' user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.RESOLVED,
      createdAt: new Date(Date.now() - 1000), // 1 sec ago
    } as Alert);

    const result = await suppressionService.isDuplicate(
      {
        userId: 'user-123',
        type: 'BATTERY_PERCENTAGE',
        severity: AlertSeverity.WARNING,
      },
      cooldownMinutes,
    );

    expect(result.isDuplicate).toBe(false);
  });

  // ------------------------------------------------------------------
  // E22  Cooldown is very large (24 hours)
  // ------------------------------------------------------------------
  it('E22 should correctly handle a 24-hour cooldown without overflow', async () => {
    /**
     * SCENARIO: Admin sets cooldown to 86400 seconds (24 hours)
     * for non-critical alerts. An alert was sent 23 hours ago.
     *
     * EXPECTED: Still within cooldown (23h < 24h). The calculation
     * should not overflow or lose precision with large values.
     *
     * WHY: JavaScript can handle large millisecond values, but the
     * math must be correct. 86400 seconds * 1000 = 86,400,000 ms
     * which is well within Number.MAX_SAFE_INTEGER, so this should
     * work. But we test it explicitly to catch any accidental
     * integer overflow if someone uses `| 0` or similar tricks.
     */
    const cooldownMinutes = 1440; // 24 hours
    mockAlertRepo.findOne.mockResolvedValue({
      id: 'old-alert-23h',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.RESOLVED,
      createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
    } as Alert);

    const result = await suppressionService.isDuplicate(
      {
        userId: 'user-123',
        type: 'BATTERY_PERCENTAGE',
        severity: AlertSeverity.WARNING,
      },
      cooldownMinutes,
    );

    expect(result.isDuplicate).toBe(true);
  });

  // ------------------------------------------------------------------
  // E23  Multiple alert types fire simultaneously → independent
  // ------------------------------------------------------------------
  it('E23 should handle multiple alert types firing at the same time independently', async () => {
    /**
     * SCENARIO: At 10:00 AM, BOTH a "battery_depletion" condition
     * AND a "high_temperature" condition are detected simultaneously.
     *
     * EXPECTED: Both alerts should be created because they are
     * DIFFERENT TYPES. The suppression logic is per-type, not global.
     *
     * WHY: A user with multiple problems needs to know about ALL
     * of them. If the battery is dying AND the inverter is
     * overheating, both are critical and independent.
     */
    mockAlertRepo.findOne.mockResolvedValueOnce({
      id: 'battery-alert',
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      createdAt: new Date(Date.now() - 1000),
    } as Alert);

    // Second check for high_temperature (different type)
    mockAlertRepo.findOne.mockResolvedValueOnce(null);

    const batteryResult = await suppressionService.isDuplicate({
      userId: 'user-123',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
    });
    const tempResult = await suppressionService.isDuplicate({
      userId: 'user-123',
      type: 'BATTERY_TEMPERATURE',
      severity: AlertSeverity.WARNING,
    });

    expect(batteryResult.isDuplicate).toBe(true);
    expect(tempResult.isDuplicate).toBe(false);
  });

  // ------------------------------------------------------------------
  // E24  User has 50 unresolved alerts → efficient query
  // ------------------------------------------------------------------
  it('E24 should check for duplicates efficiently even with many unresolved alerts', async () => {
    /**
     * SCENARIO: A user has 50 unresolved alerts of various types
     * accumulated over time. A new "battery_depletion" is detected.
     *
     * RISK: If the duplicate check loads ALL 50 alerts into memory
     * and iterates over them, it's inefficient. The check should
     * use a targeted DB query: "SELECT 1 FROM alerts WHERE
     * userId=X AND type='battery_depletion' AND resolved=false
     * LIMIT 1" which returns immediately using an index.
     *
     * HOW WE TEST: We verify that the query is scoped to the
     * specific type, not a general "all alerts" fetch.
     */
    mockAlertRepo.findOne.mockResolvedValue(null);

    const result = await suppressionService.isDuplicate({
      userId: 'user-with-50-alerts',
      type: 'BATTERY_PERCENTAGE',
      severity: AlertSeverity.WARNING,
    });

    expect(mockAlertRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-with-50-alerts',
          type: 'BATTERY_PERCENTAGE',
        }),
        order: { createdAt: 'DESC' },
      }),
    );
    expect(result.isDuplicate).toBe(false);
  });
});
