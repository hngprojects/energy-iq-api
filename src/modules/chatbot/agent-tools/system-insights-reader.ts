import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentTool } from '../helpers/agent-tool';
import { InvertersMetricsService } from '../../inverters-metrics/inverters-metrics.service';
import { InverterModelAction } from '../../inverters/action/inverters.action';

@Injectable()
export class SystemInsightsReader implements AgentTool {
  private readonly logger = new Logger(SystemInsightsReader.name);
  constructor(
    private readonly metricsService: InvertersMetricsService,
    private readonly inverterAction: InverterModelAction,
  ) {}

  create(userId: string) {
    // No input needed — all context comes from live readings
    const schema = z.object({});

    return tool(async () => await this.readInsights(userId), {
      name: 'read_system_insights',
      description: this.getDescription(),
      schema,
    });
  }

  getDescription(): string {
    return `
      Computes real-time actionable insights from the user's current inverter state.

      Use this tool when the user asks about:
      - How long their battery will last at the current rate of usage
      - Whether they should reduce consumption or turn things off
      - How much money/savings they stand to lose if the battery dies now
      - What load they should shed to keep running on solar
      - Anything involving battery life projections, depletion risk, or load advice
      - "Should I be worried about my battery right now?"
      - "How much longer do I have before power cuts?"
      - Any request for a real-time system insight or recommendation

      Do NOT use this tool for:
      - Historical energy data — use read_metrics for that
      - Past or cumulative savings — use read_savings for that
      - Alert history — use read_alerts for that

      Returns:
      - snapshot: current SOC %, load (kW), solar (kW), net discharge rate
      - depletion: estimated minutes/hours until battery hits 20% cutoff
        (null if charging or balanced)
      - savingsAtRisk: how much ₦ savings the user loses if battery dies now
      - loadReduction: how much load to shed to reach solar balance, and the
        extra runtime and ₦ savings gained by doing so
      - flags: isCharging, isLow, isCritical, solarIsOn

      If depletion.estimatedDepletionMinutes is null, the battery is not draining
      (either solar covers the load or the system is charging).
    `;
  }

  private async readInsights(userId: string): Promise<string> {
    const inverterId = await this.inverterAction.findFirstIdByUserId(userId);
    if (!inverterId) {
      return 'No inverters found for your account.';
    }

    try {
      const result = await this.metricsService.getSystemInsights(inverterId);
      return JSON.stringify(result);
    } catch (err) {
      this.logger.error(
        'Failed to compute system insights',
        err instanceof Error ? err.stack : String(err),
      );
      return 'Unable to compute system insights at this time. Please try again.';
    }
  }
}
