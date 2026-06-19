import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { GeneralKeyMetrics } from '../types/reports.type';
import { ReportPeriod, ReportStatus } from '../../../common/enums/reports.type';
import {
  buildAssumptionsTable,
  buildMetricRow,
  buildReportHeader,
  buildSectionTitle,
  STYLES,
} from './shared';

export function buildGeneralReportDefinition(ctx: {
  name: string;
  period: ReportPeriod;
  status: ReportStatus;
  dateDelivered: Date | null;
  metrics: GeneralKeyMetrics;
}): TDocumentDefinitions {
  const { metrics } = ctx;

  return {
    content: [
      ...buildReportHeader(
        'General Report',
        ctx.name,
        ctx.period,
        ctx.status,
        ctx.dateDelivered,
      ),

      // Alert section
      buildSectionTitle('Alert Summary'),
      buildMetricRow('Total Alerts', metrics.totalAlerts),
      buildMetricRow('Resolved', metrics.resolvedAlerts),
      buildMetricRow('Unresolved', metrics.unresolvedAlerts),
      buildMetricRow('Resolution Rate (%)', metrics.resolutionRate),
      buildMetricRow('Dominant Alert Type', metrics.dominantAlertType ?? 'N/A'),
      buildMetricRow(
        'Dominant Severity',
        metrics.dominantAlertSeverity ?? 'N/A',
      ),

      // Cost & Savings section
      buildSectionTitle('Cost & Savings'),
      buildMetricRow('Total Cost Saved (NGN)', metrics.totalCostSavedNgn),
      buildMetricRow(
        'Generator Cost Avoided (NGN)',
        metrics.generatorCostAvoidedNgn,
      ),
      buildMetricRow('Fuel Saved (Litres)', metrics.fuelSavedLitres),
      buildMetricRow('CO\u2082 Avoided (kg)', metrics.co2AvoidedKg),
      buildMetricRow(
        'Total Energy Generated (kWh)',
        metrics.totalEnergyGeneratedKwh,
      ),
      buildMetricRow(
        'Total Energy Consumed (kWh)',
        metrics.totalEnergyConsumedKwh,
      ),
      { text: 'Assumptions', style: 'subSectionHeader', marginTop: 10 },
      buildAssumptionsTable([
        ['Fuel Type', metrics.meta.fuelType],
        ['Fuel Price (\u20A6/L)', metrics.meta.fuelPricePerLitreNgn],
        [
          'Generator Rated Power (kW)',
          metrics.meta.assumedGeneratorRatedPowerKw,
        ],
        ['Consumption Rate (L/hr)', metrics.meta.assumedConsumptionRateLPerHr],
      ]),

      // Solar section
      buildSectionTitle('Solar Performance'),
      buildMetricRow('Solar Generated (kWh)', metrics.solarKwh),
      buildMetricRow('Average Battery SoC (%)', metrics.avgBatterySoc),
      buildMetricRow('Average Load (kW)', metrics.avgLoadKw),
      buildMetricRow('Total Active Hours', metrics.totalActiveHours),
      ...(metrics.solarCoveragePercent != null
        ? [buildMetricRow('Solar Coverage (%)', metrics.solarCoveragePercent)]
        : []),
    ],
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
  };
}
