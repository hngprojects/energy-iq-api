import { Injectable } from '@nestjs/common';
import { AgentTool } from '../helpers/agent-tool';
import { tool } from '@langchain/core/tools';
import { FindAlertsDto } from '../dto/find-alerts.dto';
import { AlertModelAction } from '../../alerts/actions/alert.action';
import { z } from 'zod';

@Injectable()
export class AlertReader implements AgentTool {
  constructor(private readonly alertAction: AlertModelAction) {}

  create(userId: string) {
    const schema = z.object({
      end_date: z.iso
        .date()
        .optional()
        .describe(
          'ISO date string (YYYY-MM-DD). Only include alerts created on or before this date.',
        ),
      platform: z
        .enum(['victron', 'growatt', 'sunsynk'])
        .optional()
        .describe(
          'The inverter platform. Must be exactly one of: "victron", "growatt", "sunsynk".',
        ),
      // resolved field replaced by status enum — see below
      status: z
        .enum(['active', 'resolved', 'all'])
        .optional()
        .default('all')
        .describe(
          '"active" = currently active alerts (status: UNRESOLVED -> isActive: true). ' +
            '"resolved" = alerts that have been resolved. ' +
            '"all" = no filter, return everything. ' +
            'Default is "all". Use "active" when the user asks about current/ongoing alerts.',
        ),
      severity: z
        .enum(['low', 'medium', 'high', 'critical'])
        .optional()
        .describe(
          'Alert severity. Must be exactly one of: "low", "medium", "high", "critical".',
        ),
      start_date: z.iso
        .date()
        .optional()
        .describe(
          'ISO date string (YYYY-MM-DD). Only include alerts created on or after this date.',
        ),
      type: z
        .string()
        .optional()
        .describe(
          'The alert type category, e.g. "battery", "temperature", "voltage". Omit to fetch all types.',
        ),
    });

    return tool(
      async (dto: FindAlertsDto) => await this.readAlert(dto, userId),
      {
        name: 'read_alerts',
        description: this.getDescription(),
        schema,
      },
    );
  }

  getDescription(): string {
    return `
      Retrieves alert records from the alerts table in the database.

      Use this tool when the user asks about:
      - Active or recent alerts
      - Alert history, trends, or summaries
      - Whether any alerts have been triggered
      - Reports or dashboards that include alert data
      - Monitoring status or system health that involves alerts

      Do NOT use this tool for:
      - General report data unrelated to alerts
      - Metrics, logs, or events stored in other tables
      - Creating, updating, or dismissing alerts

      Returns a list of alert records including fields such as id, severity,
      message, status, and timestamp.
    `;
  }

  async readAlert(options: FindAlertsDto, userId: string) {
    const alerts = await this.alertAction.findAlertsWhere(options, userId);
    if (!alerts || alerts.length === 0) {
      return 'No alerts found matching the given criteria.';
    }
    return JSON.stringify(alerts);
  }
}
