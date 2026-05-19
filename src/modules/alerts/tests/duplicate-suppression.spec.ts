// ==================================================================
// DUPLICATE SUPPRESSION LOGIC
// Tests for DuplicateSuppressionService in helpers/duplicate-suppression.ts
//
// The DB query already filters by userId + type, so the mock should
// only return alerts of the same type as the input. Tests that check
// "different type → allow" verify that the query is called with the
// correct type, not that the service filters by type after the fact.
// ==================================================================

jest.mock('../../../config/env', () => ({}));

import {
  AlertResolutionStatus,
  AlertSeverity,
  AlertType,
} from '../../../common/enums';
import { DuplicateSuppressionService } from '../helpers/duplicate-suppression';

// ------------------------------------------------------------------
// Fresh mock repo per test — no shared state
// ------------------------------------------------------------------
function makeService() {
  const alertRepo = {
    findOne: jest.fn(),
  };
  const service = new DuplicateSuppressionService(alertRepo as never);
  return { service, alertRepo };
}

function makeExistingAlert(overrides: Partial<any> = {}) {
  return {
    id: 'existing-id',
    userId: 'user-123',
    type: AlertType.BATTERY_PERCENTAGE,
    severity: AlertSeverity.WARNING,
    resolutionStatus: AlertResolutionStatus.UNRESOLVED,
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    ...overrides,
  };
}

// ------------------------------------------------------------------
// TESTS  (4.1 – 4.10)   —   Core Suppression Logic
// ------------------------------------------------------------------
describe('DuplicateSuppression — Test Cases', () => {
  it('4.1 should suppress when an unresolved alert of the same type exists for the same user', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      }),
    );

    const result = await service.isDuplicate({
      userId: 'user-123',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.WARNING,
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toBe('unresolved_alert_exists');
  });

  it('4.2 should allow a new alert when the previous one was resolved (cooldown=0)', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      0,
    );

    expect(result.isDuplicate).toBe(false);
  });

  it('4.3 should allow a new alert when no existing alert of that type exists for the user', async () => {
    // The DB query filters by type — if no BATTERY_PERCENTAGE alert exists,
    // findOne returns null. This covers the "different type" scenario too.
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(null);

    const result = await service.isDuplicate({
      userId: 'user-123',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.WARNING,
    });

    expect(result.isDuplicate).toBe(false);
    // Verify the query was scoped to the correct type
    expect(alertRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: AlertType.BATTERY_PERCENTAGE,
        }) as { type: AlertType },
      }),
    );
  });

  it('4.4 should allow alerts for different users independently', async () => {
    const { service, alertRepo } = makeService();
    // No alert found for user-B
    alertRepo.findOne.mockResolvedValue(null);

    const result = await service.isDuplicate({
      userId: 'user-B',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.WARNING,
    });

    expect(result.isDuplicate).toBe(false);
    expect(alertRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-B' }) as {
          userId: string;
        },
      }),
    );
  });

  it('4.5 should suppress when within cooldown window (alert 5 min ago, cooldown 15 min)', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      15,
    );

    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain('within_cooldown');
  });

  it('4.6 should allow when cooldown has expired (alert 20 min ago, cooldown 15 min)', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      15,
    );

    expect(result.isDuplicate).toBe(false);
  });

  it('4.7 should bypass suppression when severity upgrades from WARNING to CRITICAL', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        severity: AlertSeverity.WARNING,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
        createdAt: new Date(Date.now() - 2 * 60 * 1000),
      }),
    );

    const result = await service.isDuplicate({
      userId: 'user-123',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.reason).toBe('severity_upgrade');
  });

  it('4.8 should allow instant re-alerts when cooldown is 0', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(Date.now() - 1000), // 1 second ago
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      0,
    );

    expect(result.isDuplicate).toBe(false);
  });

  it('4.9 should correctly suppress within a 24-hour cooldown (alert 23h ago)', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      1440, // 24 hours in minutes
    );

    expect(result.isDuplicate).toBe(true);
  });

  it('4.10 should handle two alert types independently — one suppressed, one allowed', async () => {
    const { service, alertRepo } = makeService();

    // First call: BATTERY_PERCENTAGE has an unresolved alert → suppress
    alertRepo.findOne.mockResolvedValueOnce(
      makeExistingAlert({
        type: AlertType.BATTERY_PERCENTAGE,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      }),
    );
    // Second call: BATTERY_TEMPERATURE has no alert → allow
    alertRepo.findOne.mockResolvedValueOnce(null);

    const batteryResult = await service.isDuplicate({
      userId: 'user-123',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.WARNING,
    });
    const tempResult = await service.isDuplicate({
      userId: 'user-123',
      type: AlertType.BATTERY_TEMPERATURE,
      severity: AlertSeverity.WARNING,
    });

    expect(batteryResult.isDuplicate).toBe(true);
    expect(tempResult.isDuplicate).toBe(false);
  });
});

// ------------------------------------------------------------------
// EDGE CASES  (E19 – E24)
// ------------------------------------------------------------------
describe('DuplicateSuppression — Edge Cases', () => {
  it('E19 should return isDuplicate=false when no existing alert found (first-ever alert)', async () => {
    // Simulates the first alert for a user — no race condition possible
    // when findOne returns null (no prior alert exists)
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(null);

    const result = await service.isDuplicate({
      userId: 'user-new',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.CRITICAL,
    });

    expect(result.isDuplicate).toBe(false);
  });

  it('E20 should suppress within cooldown even if the previous alert was resolved', async () => {
    // Alert fired 10 min ago, resolved 8 min ago, cooldown=15 min
    // Cooldown counts from creation time, not resolution time
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      15,
    );

    expect(result.isDuplicate).toBe(true);
  });

  it('E21 should allow re-alerts immediately when cooldown=0 regardless of how recent the last alert was', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(), // just now
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      0,
    );

    expect(result.isDuplicate).toBe(false);
  });

  it('E22 should handle 24-hour cooldown without numeric overflow', async () => {
    const { service, alertRepo } = makeService();
    // 23h elapsed, cooldown=1440min (24h) → still within cooldown
    alertRepo.findOne.mockResolvedValue(
      makeExistingAlert({
        resolutionStatus: AlertResolutionStatus.RESOLVED,
        createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
      }),
    );

    const result = await service.isDuplicate(
      {
        userId: 'user-123',
        type: AlertType.BATTERY_PERCENTAGE,
        severity: AlertSeverity.WARNING,
      },
      1440,
    );

    expect(result.isDuplicate).toBe(true);
    // Verify no overflow — result should be a valid boolean
    expect(typeof result.isDuplicate).toBe('boolean');
  });

  it('E23 should query with the correct type so different alert types are independent', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(null);

    await service.isDuplicate({
      userId: 'user-123',
      type: AlertType.BATTERY_TEMPERATURE,
      severity: AlertSeverity.HIGH,
    });

    // The query must be scoped to BATTERY_TEMPERATURE, not a global fetch
    expect(alertRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-123',
          type: AlertType.BATTERY_TEMPERATURE,
        }) as { userId: string; type: AlertType },
      }),
    );
  });

  it('E24 should use a targeted query (userId + type) not a full table scan', async () => {
    const { service, alertRepo } = makeService();
    alertRepo.findOne.mockResolvedValue(null);

    await service.isDuplicate({
      userId: 'user-with-50-alerts',
      type: AlertType.BATTERY_PERCENTAGE,
      severity: AlertSeverity.WARNING,
    });

    expect(alertRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-with-50-alerts',
          type: AlertType.BATTERY_PERCENTAGE,
        }) as { userId: string; type: AlertType },
        order: { createdAt: 'DESC' },
      }),
    );
  });
});

// ------------------------------------------------------------------
// isSeverityUpgrade — pure method tests
// ------------------------------------------------------------------
describe('DuplicateSuppression — isSeverityUpgrade', () => {
  const { service } = makeService();

  it('should return true when incoming is CRITICAL and existing is WARNING', () => {
    expect(
      service.isSeverityUpgrade(AlertSeverity.WARNING, AlertSeverity.CRITICAL),
    ).toBe(true);
  });

  it('should return true when incoming is HIGH and existing is LOW', () => {
    expect(
      service.isSeverityUpgrade(AlertSeverity.LOW, AlertSeverity.HIGH),
    ).toBe(true);
  });

  it('should return false when incoming is same severity as existing', () => {
    expect(
      service.isSeverityUpgrade(AlertSeverity.WARNING, AlertSeverity.WARNING),
    ).toBe(false);
  });

  it('should return false when incoming is lower severity than existing', () => {
    expect(
      service.isSeverityUpgrade(AlertSeverity.CRITICAL, AlertSeverity.WARNING),
    ).toBe(false);
  });
});
