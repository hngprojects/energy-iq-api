import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportsService } from './reports.service';

/** How long (in minutes) a report may stay in PROCESSING before it's
 *  considered orphaned and reset back to PENDING for a fresh attempt. */
const STALE_PROCESSING_THRESHOLD_MINUTES = 30;

@Injectable()
export class ReportsCron {
  private readonly logger = new Logger(ReportsCron.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Fix 4: Orphan recovery.
   * Runs every 15 minutes. Finds reports stuck in PROCESSING longer than the
   * threshold (worker crashed before the catch block could run) and resets
   * them to PENDING so they can be retried.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async resetStalledReports(): Promise<void> {
    const count = await this.reportsService.resetStalledProcessingReports(
      STALE_PROCESSING_THRESHOLD_MINUTES,
    );
    if (count > 0) {
      this.logger.warn(
        `Reset ${count} stalled PROCESSING report(s) back to PENDING`,
      );
    }
  }
}
