import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import type { SolarKeyMetrics } from '../types/reports.type';
import { ReportPeriod, ReportStatus } from '../../../common/enums/reports.type';
import { buildReportHeader, buildMetricRow, STYLES } from './shared';

export function buildSolarReportDefinition(ctx: {
  name: string;
  period: ReportPeriod;
  status: ReportStatus;
  dateDelivered: Date | null;
  metrics: SolarKeyMetrics;
}): TDocumentDefinitions {
  const { metrics } = ctx;

  const metricsContent: Content[] = [
    { text: 'Key Metrics', style: 'sectionHeader' },
    buildMetricRow('Solar Generated (kWh)', metrics.solarKwh),
    buildMetricRow('Average Battery SoC (%)', metrics.avgBatterySoc),
    buildMetricRow('Average Load (kW)', metrics.avgLoadKw),
    buildMetricRow('Total Active Hours', metrics.totalActiveHours),
  ];

  if (metrics.solarCoveragePercent != null) {
    metricsContent.push(buildMetricRow('Solar Coverage (%)', metrics.solarCoveragePercent));
  }

  return {
    content: [
      ...buildReportHeader('Solar Report', ctx.name, ctx.period, ctx.status, ctx.dateDelivered),
      ...metricsContent,
    ],
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
  };
}
