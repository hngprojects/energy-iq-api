import { Injectable } from '@nestjs/common';
import { AgentTool } from '../helpers/agent-tool';
import { tool } from '@langchain/core/tools';
import { FindAlertsDto } from '../dto/find-alerts.dto';
import { AlertModelAction } from '../../alerts/actions/alert.action';

@Injectable()
export class AlertReader implements AgentTool {
  constructor(private readonly alertAction: AlertModelAction) {}

  create() {
    return tool(async (dto: FindAlertsDto) => await this.readAlert(dto), {
      name: 'read_alerts',
      description: this.getDescription(),
      schema: {
        type: 'object',
        properties: {
          count: {
            type: 'integer',
            description: 'the number of alerts the user wants to read',
          },
          end_date: {
            type: 'string',
            description:
              'a date whose value must come at the time of or after the creation date of the alert',
            format: 'date',
          },
          platform: {
            type: 'string',
            description:
              'the inverter plaftorm. it can be one of "victron", "growatt" or "sunsynk". It is represented by the column named "platform" in the alerts table',
          },
          resolved: {
            type: 'string',
            description:
              'the inverter plaftorm. it can be one of "victron", "growatt" or "sunsynk". It is represented by the column named "platform" in the alerts table',
          },
          severity: {
            type: 'string',
            description:
              'this represents the severity of the alert. its value must be either "low", "medium", "high" or "critical". It is represented by the column named "severity" in the alerts table',
          },
          start_date: {
            type: 'string',
            description:
              'a date whose value must come before or on the creation date of the alert',
            format: 'date',
          },
          type: {
            type: 'string',
            description:
              'this represents the type of the alert. It is represented by the column named "severity" in the alerts table',
          },
        },
      },
    });
  }

  /**
   *
   * @returns
   * export class FindAlertsDto {
     count?: number;
     end_date?: Date;
     platform?: string;
     resolved?: boolean;
     severity?: string;
     start_date?: Date;
     type?: string;
     userId?: string;
   }
   */

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

  async readAlert(options: FindAlertsDto) {
    return await this.alertAction.findAlertsWhere(options);
  }
}
