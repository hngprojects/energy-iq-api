import { InverterBrand } from '../../../common/enums';

export interface VerifiedSystem {
  model: string;
  serialNumber: string;
  installationId: string; // plant/site-level ID (used as the system identifier)
  brandDeviceId?: string; // device-level ID where the brand distinguishes plant vs device (e.g. Growatt device_sn)
  ratedCapacityKwh: number;
  timezone: string | null; // Growatt v1 does not return timezone
  isOnGrid: boolean | null; // Growatt v1 does not return grid status
  hasGenerator: boolean;
  mqttHost: string | null; // Victron-specific; null for all other brands
}

export interface NormalisedMetric {
  inverterId: string;
  inverterBrand: InverterBrand;
  recordedAt: string; // ISO 8601 UTC string

  inverterStatus: string; // normalised: 'normal' | 'standby' | 'fault' | 'unknown'

  solarPowerKw: number | null;
  acOutputPowerKw: number | null;

  gridVoltageV: number | null;
  gridFrequencyHz: number | null;

  batterySoc: number | null; // % — null when no battery or brand doesn't expose it
  batteryVoltageV: number | null;
  batteryCurrentA: number | null; // Victron only
  batteryTemperatureC: number | null; // Victron only
  batteryTimeToGoMin: number | null; // Victron only

  inverterTemperatureC: number | null;

  pvString1PowerKw: number | null;
  pvString2PowerKw: number | null;

  energyGeneratedTodayKwh: number | null;
  totalEnergyGeneratedKwh: number | null;
  batteryChargedTodayKwh: number | null;
  batteryDischargedTodayKwh: number | null;
  gridExportTodayKwh: number | null;
  gridImportTodayKwh: number | null;
}
