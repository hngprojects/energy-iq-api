import { AlertSeverity, AlertType } from '../../../common/enums';
import { GeneratorFuelType } from '../../../common/enums/generator';
import {
  ReportPeriod,
  ReportStatus,
  ReportType,
} from '../../../common/enums/reports.type';

interface ReportBase {
  name: string;
  period: ReportPeriod;
  status: ReportStatus;
  dateRequested: Date;
  dateDelivered: Date;
}

interface SolarKeyMetrics {
  solarKwh: number;
  avgBatterySoc: number;
  avgLoadKw: number;
  totalActiveHours: number;
}

interface AlertKeyMetrics {
  totalAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
  dominantAlertType: AlertType | null;
  dominantAlertSeverity: AlertSeverity | null;
  resolutionRate: number;
}

interface CostSavingsKeyMetrics {
  totalCostSavedNgn: number;
  generatorCostAvoidedNgn: number;
  fuelSavedLitres: number;
  co2AvoidedKg: number;
  totalActiveHours: number;
  totalEnergyGeneratedKwh: number;
  totalEnergyConsumedKwh: number;
  meta: {
    fuelType: GeneratorFuelType;
    fuelPricePerLitreNgn: number;
    assumedGeneratorRatedPowerKw: number;
    assumedConsumptionRateLPerHr: number;
  };
}

interface GeneralKeyMetrics
  extends AlertKeyMetrics, CostSavingsKeyMetrics, SolarKeyMetrics {}

export type SolarReport = ReportBase & {
  type: ReportType.SOLAR;
  keyMetrics: SolarKeyMetrics;
};

export type AlertReport = ReportBase & {
  type: ReportType.ALERT;
  keyMetrics: AlertKeyMetrics;
};

export type CostSavingsReport = ReportBase & {
  type: ReportType.CSC;
  keyMetrics: CostSavingsKeyMetrics;
};

export type GeneralReport = ReportBase & {
  type: ReportType.GENERAL;
  keyMetrics: GeneralKeyMetrics;
};

export type AnyReport =
  | AlertReport
  | SolarReport
  | CostSavingsReport
  | GeneralReport;

export type ReportKeyMetrics =
  | AlertKeyMetrics
  | SolarKeyMetrics
  | CostSavingsKeyMetrics;
