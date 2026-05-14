import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import {
  GrowattDevice,
  GrowattDeviceListResponse,
  GrowattPlant,
  GrowattPlantListResponse,
  GrowattQueryLastDataResponse,
} from '../types/growatt.types';
import { NormalisedMetric, VerifiedSystem } from '../types/shared.types';
import { BrandApiException } from '../types/brand-api.exception';
import { appConfig } from '../../../config/app.config';

@Injectable()
export class GrowattAdapter {
  constructor(
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  private tokenHeader(apiToken: string): Record<string, string> {
    return { token: apiToken };
  }

  async verifyAndGetGrowattSystem(apiToken: string): Promise<VerifiedSystem> {
    const plantRes = await fetch(
      `${this.appCfg.growattApiBaseUrl}/v1/plant/list`,
      {
        headers: this.tokenHeader(apiToken),
      },
    );

    if (!plantRes.ok) {
      throw new BadRequestException(
        'Could not connect to your Growatt account. Check your API token.',
      );
    }

    const plantData = (await plantRes.json()) as GrowattPlantListResponse;

    if (plantData.error_code !== 0) {
      throw new BadRequestException(
        'No power stations found on your Growatt account.',
      );
    }

    const plant: GrowattPlant | undefined = plantData.data?.length
      ? plantData.data[0]
      : plantData.plant_id
        ? (plantData as unknown as GrowattPlant)
        : undefined;

    if (!plant?.plant_id) {
      throw new BadRequestException(
        'No power stations found on your Growatt account.',
      );
    }

    const plantId = plant.plant_id;

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

    if (deviceData.error_code !== 0) {
      throw new BadRequestException(
        'No inverter device found under your Growatt plant.',
      );
    }

    // Handle both flat and wrapped shapes
    const device: GrowattDevice | undefined = deviceData.data?.length
      ? deviceData.data[0]
      : deviceData.device_sn
        ? (deviceData as unknown as GrowattDevice)
        : undefined;

    if (!device?.device_sn) {
      throw new BadRequestException(
        'No inverter device found under your Growatt plant.',
      );
    }

    if (device.type !== 1) {
      throw new BadRequestException(
        'No inverter (type 1) found under your Growatt plant.',
      );
    }

    return {
      model: device.model,
      serialNumber: device.device_sn,
      installationId: plantId,
      brandDeviceId: device.device_sn,
      ratedCapacityKwh: plant.peak_power
        ? parseFloat((plant.peak_power / 1000).toFixed(2))
        : 0,
      timezone: null,
      isOnGrid: null,
      hasGenerator: false,
      mqttHost: null,
    };
  }

  async fetchMetrics(
    deviceSn: string,
    apiToken: string,
  ): Promise<NormalisedMetric> {
    const body = new URLSearchParams({ deviceType: 'min', deviceSn });

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

    const data = (await res.json()) as GrowattQueryLastDataResponse;

    if (data.code !== 0 || !data.data?.min?.length) {
      throw new BrandApiException(
        502,
        `Growatt returned no data for device ${deviceSn}: ${data.message}`,
      );
    }

    const d = data.data.min[0];

    const batterySoc =
      d.bmsSOC != null ? d.bmsSOC : d.bdc1Soc != null ? d.bdc1Soc : null;

    const batteryVoltage =
      d.bmsVbat != null ? d.bmsVbat : d.bdc1Vbat != null ? d.bdc1Vbat : null;

    return {
      inverterId: '',
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

  private normaliseStatus(status: number): string {
    const map: Record<number, string> = {
      0: 'standby',
      1: 'normal',
      2: 'fault',
    };
    return map[status] ?? 'unknown';
  }
}
