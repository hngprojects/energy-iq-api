import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import {
  GrowattDevice,
  GrowattDeviceListResponse,
  GrowattMinData,
  GrowattPlant,
  GrowattPlantListResponse,
  GrowattQueryLastDataResponse,
  GrowattStorageData,
} from '../types/growatt.types';
import { NormalisedMetric, VerifiedSystem } from '../types/shared.types';
import { BrandApiException } from '../types/brand-api.exception';
import { appConfig } from '../../../config/app.config';
import { InverterBrand } from '../../../common/enums';

/** Growatt device type codes returned by /v1/device/list */
const GROWATT_TYPE_MIN = 1; // grid-tie inverter
const GROWATT_TYPE_STORAGE = 2; // hybrid / off-grid storage inverter

@Injectable()
export class GrowattAdapter {
  constructor(
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  private tokenHeader(apiToken: string): Record<string, string> {
    return { token: apiToken };
  }

  // ─── Connection verification ──────────────────────────────────────────────

  async verifyAndGetGrowattSystem(apiToken: string): Promise<VerifiedSystem> {
    // 1. Fetch plant list
    const plantRes = await fetch(
      `${this.appCfg.growattApiBaseUrl}/v1/plant/list`,
      { headers: this.tokenHeader(apiToken) },
    );

    if (!plantRes.ok) {
      throw new BadRequestException(
        'Could not connect to your Growatt account. Check your API token.',
      );
    }

    const plantData = (await plantRes.json()) as GrowattPlantListResponse;

    if (plantData.error_code !== 0 || !plantData.data?.plants?.length) {
      throw new BadRequestException(
        'No power stations found on your Growatt account.',
      );
    }

    const plant: GrowattPlant = plantData.data.plants[0];

    if (!plant.plant_id) {
      throw new BadRequestException(
        'No power stations found on your Growatt account.',
      );
    }

    const plantId = String(plant.plant_id);

    // 2. Fetch device list for the first plant
    const deviceRes = await fetch(
      `${this.appCfg.growattApiBaseUrl}/v1/device/list?plant_id=${plantId}`,
      { headers: this.tokenHeader(apiToken) },
    );

    if (!deviceRes.ok) {
      throw new BadRequestException(
        'Could not retrieve inverter device from your Growatt plant.',
      );
    }

    const deviceData = (await deviceRes.json()) as GrowattDeviceListResponse;

    if (deviceData.error_code !== 0 || !deviceData.data?.devices?.length) {
      throw new BadRequestException(
        'No inverter device found under your Growatt plant.',
      );
    }

    // Accept both grid-tie (type 1) and storage/hybrid (type 2) devices.
    // Pick the first device that is a recognised inverter type.
    const device: GrowattDevice | undefined = deviceData.data.devices.find(
      (d) => d.type === GROWATT_TYPE_MIN || d.type === GROWATT_TYPE_STORAGE,
    );

    if (!device?.device_sn) {
      throw new BadRequestException(
        'No supported inverter device (grid-tie or storage) found under your Growatt plant.',
      );
    }

    return {
      model: device.model || device.manufacturer || 'Growatt',
      serialNumber: device.device_sn,
      installationId: plantId,
      brandDeviceId: device.device_sn,
      // Battery capacity is not exposed by the Growatt plant API.
      // peak_power is the solar panel array rating (kW), not battery capacity.
      // Leave ratedCapacityKwh at 0 so the user can configure it manually.
      ratedCapacityKwh: 0,
      timezone: null,
      isOnGrid: null,
      hasGenerator: false,
      mqttHost: null,
    };
  }

  // ─── Metrics polling ──────────────────────────────────────────────────────

  /**
   * Fetches the latest metrics for a Growatt device.
   *
   * Strategy:
   *   1. Try `deviceType: 'storage'` first (covers hybrid/off-grid SPF/SPH units).
   *   2. If the response contains no storage data, fall back to `deviceType: 'min'`
   *      (covers grid-tie MIN/TLX units).
   *
   * This means a single adapter method works for both device families without
   * needing to store the device type in the inverter record.
   */
  async fetchMetrics(
    deviceSn: string,
    apiToken: string,
  ): Promise<NormalisedMetric> {
    const storageData = await this.queryLastData(deviceSn, apiToken, 'storage');

    if (storageData?.storage?.length) {
      return this.normaliseStorageMetrics(storageData.storage[0]);
    }

    // Fall back to min (grid-tie)
    const minData = await this.queryLastData(deviceSn, apiToken, 'min');

    if (minData?.min?.length) {
      return this.normaliseMinMetrics(minData.min[0]);
    }

    throw new BrandApiException(
      502,
      `Growatt returned no data for device ${deviceSn}`,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async queryLastData(
    deviceSn: string,
    apiToken: string,
    deviceType: 'storage' | 'min',
  ): Promise<GrowattQueryLastDataResponse['data']> {
    const body = new URLSearchParams({ deviceType, deviceSn });

    const res = await fetch(
      `${this.appCfg.growattApiBaseUrl}/v4/new-api/queryLastData`,
      {
        method: 'POST',
        headers: {
          ...this.tokenHeader(apiToken),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
    );

    if (!res.ok) {
      throw new BrandApiException(
        res.status,
        `Growatt API error for device ${deviceSn}: ${res.status}`,
      );
    }

    const json = (await res.json()) as GrowattQueryLastDataResponse;

    if (json.code !== 0) {
      throw new BrandApiException(
        502,
        `Growatt API returned error code ${json.code} for device ${deviceSn}: ${json.message}`,
      );
    }

    return json.data;
  }

  /** Map a storage/hybrid device response to NormalisedMetric. */
  private normaliseStorageMetrics(d: GrowattStorageData): NormalisedMetric {
    return {
      inverterId: '',
      inverterBrand: InverterBrand.GROWATT,
      recordedAt: d.time
        ? new Date(d.time).toISOString()
        : new Date().toISOString(),
      inverterStatus: this.normaliseStatus(d.status),

      solarPowerKw:
        d.ppv != null ? parseFloat((d.ppv / 1000).toFixed(3)) : null,
      acOutputPowerKw:
        d.outPutPower != null
          ? parseFloat((d.outPutPower / 1000).toFixed(3))
          : null,

      // Storage devices are typically off-grid; vGrid is 0 when no grid present.
      gridVoltageV: d.vGrid != null && d.vGrid !== 0 ? d.vGrid : null,
      gridFrequencyHz:
        d.freqGrid != null && d.freqGrid !== 0 ? d.freqGrid : null,

      batterySoc: d.capacity ?? null,
      batteryVoltageV: d.vBat ?? null,
      batteryCurrentA: d.chgCurr ?? d.dischgCurr ?? null,
      batteryTemperatureC: null, // not exposed in storage response
      batteryTimeToGoMin: null,

      inverterTemperatureC: d.invTemperature ?? null,

      pvString1PowerKw:
        d.ppv != null ? parseFloat((d.ppv / 1000).toFixed(3)) : null,
      pvString2PowerKw:
        d.ppv2 != null ? parseFloat((d.ppv2 / 1000).toFixed(3)) : null,

      energyGeneratedTodayKwh: d.epvToday ?? null,
      totalEnergyGeneratedKwh: d.epvTotal ?? null,
      batteryChargedTodayKwh: d.eacChargeToday ?? null,
      batteryDischargedTodayKwh:
        d.eBatDisChargeToday ?? d.eacDisChargeToday ?? null,
      gridExportTodayKwh: d.eToGridToday ?? null,
      gridImportTodayKwh: d.eToUserToday ?? null,
    };
  }

  /** Map a min/grid-tie device response to NormalisedMetric. */
  private normaliseMinMetrics(d: GrowattMinData): NormalisedMetric {
    const batterySoc =
      d.bmsSOC != null ? d.bmsSOC : d.bdc1Soc != null ? d.bdc1Soc : null;

    const batteryVoltage =
      d.bmsVbat != null ? d.bmsVbat : d.bdc1Vbat != null ? d.bdc1Vbat : null;

    return {
      inverterId: '',
      inverterBrand: InverterBrand.GROWATT,
      recordedAt: d.time
        ? new Date(d.time).toISOString()
        : new Date().toISOString(),
      inverterStatus: this.normaliseStatus(d.status),

      solarPowerKw:
        d.ppv != null ? parseFloat((d.ppv / 1000).toFixed(3)) : null,
      acOutputPowerKw:
        d.pac != null ? parseFloat((d.pac / 1000).toFixed(3)) : null,

      gridVoltageV: d.vac1 ?? null,
      gridFrequencyHz: d.fac ?? null,

      batterySoc,
      batteryVoltageV: batteryVoltage,
      batteryCurrentA: null,
      batteryTemperatureC: null,
      batteryTimeToGoMin: null,

      inverterTemperatureC: d.temp1 ?? null,

      pvString1PowerKw:
        d.ppv1 != null ? parseFloat((d.ppv1 / 1000).toFixed(3)) : null,
      pvString2PowerKw:
        d.ppv2 != null ? parseFloat((d.ppv2 / 1000).toFixed(3)) : null,

      energyGeneratedTodayKwh: d.eacToday ?? null,
      totalEnergyGeneratedKwh: d.eacTotal ?? null,
      batteryChargedTodayKwh: d.echargeToday ?? null,
      batteryDischargedTodayKwh: d.edischargeToday ?? null,
      gridExportTodayKwh: d.etoGridToday ?? null,
      gridImportTodayKwh: d.etoUserToday ?? null,
    };
  }

  /**
   * Normalise Growatt status codes to a common string.
   *
   * Known codes (from real device responses and Growatt docs):
   *   0  — waiting / standby
   *   1  — normal (grid-tie: exporting)
   *   2  — fault
   *   3  — flash (firmware update)
   *   5  — PV charging
   *   6  — AC charging
   *   7  — combined charging (PV + AC)
   *   8  — combined charging + bypass
   *   9  — PV charging + bypass
   *   10 — AC charging + bypass
   *   11 — bypass mode
   *   12 — PV charge + discharge (your device's current state)
   */
  private normaliseStatus(status: number): string {
    const map: Record<number, string> = {
      0: 'standby',
      1: 'normal',
      2: 'fault',
      3: 'standby', // firmware flash — treat as temporarily unavailable
      5: 'normal', // PV charging
      6: 'normal', // AC charging
      7: 'normal', // PV + AC charging
      8: 'normal', // combined charging + bypass
      9: 'normal', // PV charging + bypass
      10: 'normal', // AC charging + bypass
      11: 'normal', // bypass
      12: 'normal', // PV charge + discharge
    };
    return map[status] ?? 'unknown';
  }
}
