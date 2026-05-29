import { Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentTool } from '../helpers/agent-tool';
import { InvertersMetricsService } from '../../inverters-metrics/inverters-metrics.service';
import { InverterModelAction } from '../../inverters/action/inverters.action';

@Injectable()
export class MetricsReader implements AgentTool {
  constructor(
    private readonly metricsService: InvertersMetricsService,
    private readonly inverterAction: InverterModelAction,
  ) {}

  create(userId: string) {
    const schema = z.object({
      mode: z
        .enum(['current', 'history'])
        .describe(
          '"current" returns the latest live reading (battery %, solar kW, load kW, voltages). ' +
            '"history" returns aggregated energy data over a period.',
        ),
      inverterId: z
        .string()
        .uuid()
        .optional()
        .describe(
          'UUID of a specific inverter to query. Omit to fetch across all inverters owned by the user.',
        ),
      period: z
        .enum(['hourly', 'daily', 'weekly', 'monthly'])
        .optional()
        .describe(
          'Time bucket for history mode. ' +
            '"hourly" = last 24 h bucketed by hour. ' +
            '"daily" = last 7 days bucketed by day. ' +
            '"weekly" = last 12 weeks bucketed by week. ' +
            '"monthly" = last 12 months bucketed by month. ' +
            'Ignored when mode is "current". Defaults to "daily" when omitted.',
        ),
    });

    return tool(async (input) => await this.readMetrics(input, userId), {
      name: 'read_metrics',
      description: this.getDescription(),
      schema,
    });
  }

  getDescription(): string {
    return `
      Retrieves energy metrics from the inverter metrics database.

      Use this tool when the user asks about:
      - Current battery level, solar generation, or load consumption
      - Whether their solar panels are producing power right now
      - Energy usage trends over time (today, this week, this month)
      - How much solar energy was generated in a given period
      - Average battery state of charge over a period
      - Average load consumption over a period
      - Any question about live or historical inverter readings

      Do NOT use this tool for:
      - Alerts or fault conditions — use read_alerts for those
      - Account or billing information
      - System health status — combine with read_alerts for a full picture

      mode "current": returns the latest single reading (solarKw, batterySocPercent,
        loadKw, gridVoltageV, batteryVoltageV, recordedAt).
      mode "history": returns time-bucketed aggregates (solarKwh, avgBatterySoc,
        avgLoadKw) for the chosen period.

      If inverterId is omitted, results are fetched for all inverters the user owns.
    `;
  }

  private async readMetrics(
    input: {
      mode: 'current' | 'history';
      inverterId?: string;
      period?: 'hourly' | 'daily' | 'weekly' | 'monthly';
    },
    userId: string,
  ): Promise<string> {
    // Resolve the list of inverter IDs to query
    let inverterIds: string[];

    if (input.inverterId) {
      // Validate ownership — the requested inverter must belong to this user
      const userIds = await this.inverterAction.findIdsByUserId(userId);
      if (!userIds.includes(input.inverterId)) {
        return 'The requested inverter was not found or does not belong to your account.';
      }
      inverterIds = [input.inverterId];
    } else {
      inverterIds = await this.inverterAction.findIdsByUserId(userId);
      if (inverterIds.length === 0) {
        return 'No inverters found for your account.';
      }
    }

    // Fetch metrics for each inverter in parallel
    const results = await Promise.all(
      inverterIds.map((id) =>
        this.metricsService.getMetricsForAgent(id, input.mode, input.period),
      ),
    );

    const hasData = results.some(
      (r) => r.data !== null && r.data !== undefined,
    );
    if (!hasData) {
      return 'No metrics data is available for your inverter(s) yet.';
    }

    return JSON.stringify(results);
  }
}
