import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentTool } from '../helpers/agent-tool';
import { InvertersMetricsService } from '../../inverters-metrics/inverters-metrics.service';
import { InverterModelAction } from '../../inverters/action/inverters.action';

@Injectable()
export class SavingsReader implements AgentTool {
  private readonly logger = new Logger(SavingsReader.name);
  constructor(
    private readonly metricsService: InvertersMetricsService,
    private readonly inverterAction: InverterModelAction,
  ) {}

  create(userId: string) {
    const schema = z.object({
      mode: z
        .enum(['cumulative', 'period', 'custom'])
        .default('cumulative')
        .describe(
          '"cumulative" (default) returns all-time savings totals with today\'s snapshot included. ' +
            'Use this when the user asks "how much have I saved?" without specifying a time range. ' +
            '"period" returns savings for a standard time window (daily/weekly/monthly/hourly). ' +
            '"custom" returns savings for an explicit date range using startDate and endDate.',
        ),
      period: z
        .enum(['hourly', 'daily', 'weekly', 'monthly'])
        .optional()
        .describe(
          'Required when mode is "period". ' +
            '"daily" = the specific calendar day given by date (defaults to today). ' +
            '"weekly" = the ISO week containing date. ' +
            '"monthly" = the calendar month containing date. ' +
            '"hourly" = the 24 h window ending at date. ' +
            'Ignored for "cumulative" and "custom" modes.',
        ),
      date: z.iso
        .date()
        .optional()
        .describe(
          'ISO date string (YYYY-MM-DD). Reference date for "period" mode. ' +
            'Defaults to today when omitted.',
        ),
      startDate: z.iso
        .date()
        .optional()
        .describe(
          'ISO date string (YYYY-MM-DD). Start of range for "custom" mode (inclusive).',
        ),
      endDate: z.iso
        .date()
        .optional()
        .describe(
          'ISO date string (YYYY-MM-DD). End of range for "custom" mode (inclusive).',
        ),
    });

    return tool(async (input) => await this.readSavings(input, userId), {
      name: 'read_savings',
      description: this.getDescription(),
      schema,
    });
  }

  getDescription(): string {
    return `
      Retrieves cost savings, fuel savings, and CO₂ data for the user's solar inverter system.

      Use this tool when the user asks about:
      - How much money they have saved by using solar (total, this month, this week, today)
      - How much fuel (petrol/diesel) they have avoided burning
      - How much CO₂ they have avoided emitting
      - Generator hours avoided
      - Savings trends over a period or custom date range
      - Any question involving naira saved, cost avoided, or environmental impact

      Do NOT use this tool for:
      - Current or live system readings (battery %, solar kW) — use read_metrics for those
      - Alerts or fault conditions — use read_alerts for those

      mode "cumulative": all-time lifetime totals plus today's savings snapshot.
        Returns: lifetimeSavingsNgn, lifetimeEnergyConsumedKwh, lifetimeFuelSavedLitres,
        co2AvoidedKg, generatorHoursAvoided, averageMonthlySavingsNgn, monthly chart,
        and a today sub-object with today's cost/fuel/CO₂ saved.

      mode "period": savings for a specific time window.
        Returns: totalCostSavedNgn, fuelSavedLitres, co2AvoidedKg, per-bucket breakdown,
        solarCoveragePercent, and meta (fuel type, price, generator assumptions).

      mode "custom": savings for an explicit start–end date range.
        Returns the same shape as "period" with auto-selected granularity.

      All monetary values are in Nigerian Naira (₦).
    `;
  }

  private async readSavings(
    input: {
      mode: 'cumulative' | 'period' | 'custom';
      period?: 'hourly' | 'daily' | 'weekly' | 'monthly';
      date?: string;
      startDate?: string;
      endDate?: string;
    },
    userId: string,
  ): Promise<string> {
    // Always use the first (oldest) inverter registered for this user.
    // By design each user has one inverter; taking the first guards against
    // edge cases where multiple exist.
    const inverterId = await this.inverterAction.findFirstIdByUserId(userId);
    if (!inverterId) {
      return 'No inverters found for your account.';
    }

    try {
      const result = await this.metricsService.getSavingsForAgent(
        inverterId,
        input.mode,
        {
          period: input.period,
          date: input.date,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      );
      return JSON.stringify(result);
    } catch (error) {
      this.logger.error(
        'Failed to retrieve savings data: ',
        error instanceof Error ? error.stack : String(error),
      );
      return 'Unable to retrieve savings data at this time. Please try again.';
    }
  }
}
