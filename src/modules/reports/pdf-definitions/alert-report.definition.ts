import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { AlertKeyMetrics } from '../types/reports.type';
import { ReportPeriod, ReportStatus } from '../../../common/enums/reports.type';
import { buildReportHeader, buildMetricRow, STYLES } from './shared';

export function buildAlertReportDefinition(ctx: {
  name: string;
  period: ReportPeriod;
  status: ReportStatus;
  dateDelivered: Date | null;
  metrics: AlertKeyMetrics;
}): TDocumentDefinitions {
  return {
    content: [
      ...buildReportHeader(
        'Alert Report',
        ctx.name,
        ctx.period,
        ctx.status,
        ctx.dateDelivered,
      ),
      { text: 'Key Metrics', style: 'sectionHeader' },
      buildMetricRow('Total Alerts', ctx.metrics.totalAlerts),
      buildMetricRow('Resolved', ctx.metrics.resolvedAlerts),
      buildMetricRow('Unresolved', ctx.metrics.unresolvedAlerts),
      buildMetricRow('Resolution Rate (%)', ctx.metrics.resolutionRate),
      buildMetricRow(
        'Dominant Alert Type',
        ctx.metrics.dominantAlertType ?? 'N/A',
      ),
      buildMetricRow(
        'Dominant Severity',
        ctx.metrics.dominantAlertSeverity ?? 'N/A',
      ),
    ],
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
  };
}
