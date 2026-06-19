import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { CostSavingsKeyMetrics } from '../types/reports.type';
import { ReportPeriod, ReportStatus } from '../../../common/enums/reports.type';
import {
  buildAssumptionsTable,
  buildMetricRow,
  buildReportHeader,
  STYLES,
} from './shared';

export function buildCostSavingsReportDefinition(ctx: {
  name: string;
  period: ReportPeriod;
  status: ReportStatus;
  dateDelivered: Date | null;
  metrics: CostSavingsKeyMetrics;
}): TDocumentDefinitions {
  const { metrics } = ctx;

  return {
    content: [
      ...buildReportHeader(
        'Cost & Savings Report',
        ctx.name,
        ctx.period,
        ctx.status,
        ctx.dateDelivered,
      ),
      { text: 'Key Metrics', style: 'sectionHeader' },
      buildMetricRow('Total Cost Saved (NGN)', metrics.totalCostSavedNgn),
      buildMetricRow(
        'Generator Cost Avoided (NGN)',
        metrics.generatorCostAvoidedNgn,
      ),
      buildMetricRow('Fuel Saved (Litres)', metrics.fuelSavedLitres),
      buildMetricRow('CO\u2082 Avoided (kg)', metrics.co2AvoidedKg),
      buildMetricRow('Total Active Hours', metrics.totalActiveHours),
      buildMetricRow(
        'Total Energy Generated (kWh)',
        metrics.totalEnergyGeneratedKwh,
      ),
      buildMetricRow(
        'Total Energy Consumed (kWh)',
        metrics.totalEnergyConsumedKwh,
      ),
      { text: 'Assumptions', style: 'sectionHeader', marginTop: 16 },
      buildAssumptionsTable([
        ['Fuel Type', metrics.meta.fuelType],
        ['Fuel Price (\u20A6/L)', metrics.meta.fuelPricePerLitreNgn],
        [
          'Generator Rated Power (kW)',
          metrics.meta.assumedGeneratorRatedPowerKw,
        ],
        ['Consumption Rate (L/hr)', metrics.meta.assumedConsumptionRateLPerHr],
      ]),
    ],
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
  };
}
