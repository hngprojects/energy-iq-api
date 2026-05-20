import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../entities/alert.entity';
import {
  AlertResolutionStatus,
  AlertSeverity,
  AlertType,
} from '../../../common/enums';

export interface DuplicateCheckInput {
  userId: string;
  type: AlertType;
  severity: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingAlert?: Alert;
  reason?: string;
}

@Injectable()
export class DuplicateSuppressionService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  /**
   * Check if a new alert would be a duplicate.
   *
   * Rules:
   * - Same userId + type + unresolved (resolutionStatus !== 'RESOLVED') → duplicate
   * - Severity upgrade (e.g., WARNING → CRITICAL) → NOT a duplicate (bypasses)
   * - Within cooldown window (even if resolved) → duplicate
   *
   * @param input - The proposed alert details
   * @param cooldownMinutes - User's cooldown setting (default 15)
   */
  async isDuplicate(
    input: DuplicateCheckInput,
    cooldownMinutes: number = 0,
  ): Promise<DuplicateCheckResult> {
    const existingAlert = await this.alertRepo.findOne({
      where: {
        userId: input.userId,
        type: input.type,
      },
      order: { createdAt: 'DESC' },
    });

    if (!existingAlert) {
      return { isDuplicate: false };
    }

    if (
      this.isSeverityUpgrade(
        existingAlert.severity,
        input.severity as AlertSeverity,
      )
    ) {
      return { isDuplicate: false, reason: 'severity_upgrade' };
    }

    if (cooldownMinutes > 0) {
      const elapsed = Date.now() - existingAlert.createdAt.getTime();
      const cooldownMs = cooldownMinutes * 60 * 1000;
      if (elapsed < cooldownMs) {
        return {
          isDuplicate: true,
          existingAlert,
          reason: `within_cooldown_${Math.ceil((cooldownMs - elapsed) / 60000)}min_remaining`,
        };
      }
    }

    if (existingAlert.resolutionStatus !== AlertResolutionStatus.RESOLVED) {
      return {
        isDuplicate: true,
        existingAlert,
        reason: 'unresolved_alert_exists',
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Determine if new severity is an upgrade from existing severity.
   * Order: LOW (0) < MEDIUM (1) < HIGH (2) < WARNING (3) < CRITICAL (4)
   */
  isSeverityUpgrade(existing: string, incoming: AlertSeverity): boolean {
    const severityOrder: Record<string, number> = {
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 1,
      [AlertSeverity.HIGH]: 2,
      [AlertSeverity.WARNING]: 3,
      [AlertSeverity.CRITICAL]: 4,
    };
    const existingRank = severityOrder[existing] ?? 0;
    const incomingRank = severityOrder[incoming] ?? 0;
    return incomingRank > existingRank;
  }
}
