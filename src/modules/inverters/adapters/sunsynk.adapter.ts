import * as crypto from 'crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import {
  SolarmanCurrentDataResponse,
  SolarmanDeviceListResponse,
  SolarmanStationListResponse,
  SolarmanTokenResponse,
  SOLARMAN_KEYS,
} from '../types/sunsynk.types';
import { NormalisedMetric, VerifiedSystem } from '../types/shared.types';
import { BrandApiException } from '../types/brand-api.exception';
import { appConfig } from '../../../config/app.config';

@Injectable()
export class SunsynkAdapter {
  constructor(
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  private async getAccessToken(
    email: string,
    password: string,
  ): Promise<string> {
    const passwordMd5 = crypto.createHash('md5').update(password).digest('hex');

    const res = await fetch(
      `${this.appCfg.sunsynkApiBaseUrl}/account/v1.0/token?language=en`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.appCfg.solarmanAppId,
          appSecret: this.appCfg.solarmanAppSecret,
          email,
          password: passwordMd5,
        }),
      },
    );

    if (!res.ok) {
      throw new BadRequestException(
        'Could not connect to your Solarman account. Check your email and password.',
      );
    }

    const data = (await res.json()) as SolarmanTokenResponse;

    if (!data.success || !data.access_token) {
      throw new BadRequestException(
        'Solarman authentication failed. Check your email and password.',
      );
    }

    return data.access_token;
  }

  private authHeader(accessToken: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  }

  async verifyAndGetSunsynkSystem(
    email: string,
    password: string,
  ): Promise<VerifiedSystem> {
    const accessToken = await this.getAccessToken(email, password);

    // get station (plant) ID
    const stationRes = await fetch(
      `${this.appCfg.sunsynkApiBaseUrl}/station/v1.0/list`,
      {
        method: 'POST',
        headers: this.authHeader(accessToken),
        body: JSON.stringify({}),
      },
    );

    if (!stationRes.ok) {
      throw new BadRequestException(
        'Could not retrieve your Solarman power station.',
      );
    }

    const stationData =
      (await stationRes.json()) as SolarmanStationListResponse;

    if (!stationData.success || !stationData.stationList?.length) {
      throw new BadRequestException(
        'No power stations found on your Solarman account.',
      );
    }

    const station = stationData.stationList[0];
    const stationId = station.id;

    // get device (logger) serial under that station
    const deviceRes = await fetch(
      `${this.appCfg.sunsynkApiBaseUrl}/device/v1.0/list?stationId=${stationId}`,
      { headers: this.authHeader(accessToken) },
    );

    if (!deviceRes.ok) {
      throw new BadRequestException(
        'Could not retrieve inverter device from your Solarman station.',
      );
    }

    const deviceData = (await deviceRes.json()) as SolarmanDeviceListResponse;

    if (!deviceData.success || !deviceData.deviceListItems?.length) {
      throw new BadRequestException(
        'No inverter device found under your Solarman station.',
      );
    }

    // Take the first inverter-type device; fall back to first device if none typed
    const device =
      deviceData.deviceListItems.find((d) => d.deviceType === 'INVERTER') ??
      deviceData.deviceListItems[0];

    return {
      model: station.name, // Solarman doesn't return inverter model; use station name
      serialNumber: device.deviceSn, // logger serial = the unique identifier
      installationId: String(stationId),
      brandDeviceId: device.deviceSn,
      ratedCapacityKwh: station.installedCapacity ?? 0, // kW from API
      timezone: null, // Solarman v1 station/list does not return timezone
      isOnGrid: null, // not returned at onboarding
      hasGenerator: false,
      mqttHost: null,
    };
  }

  async fetchMetrics(
    deviceSn: string,
    email: string,
    password: string,
  ): Promise<NormalisedMetric> {
    const accessToken = await this.getAccessToken(email, password);

    const res = await fetch(
      `${this.appCfg.sunsynkApiBaseUrl}/device/v1.0/currentData`,
      {
        method: 'POST',
        headers: this.authHeader(accessToken),
        body: JSON.stringify({ deviceSn }),
      },
    );

    if (!res.ok) {
      throw new BrandApiException(
        res.status,
        `Solarman API error for device ${deviceSn}: ${res.status}`,
      );
    }

    const data = (await res.json()) as SolarmanCurrentDataResponse;

    if (!data.success || !data.data?.dataList?.length) {
      throw new BrandApiException(
        502,
        `Solarman returned no data for device ${deviceSn}: ${data.msg}`,
      );
    }

    // Build a lookup map from the flat key-value array
    const lookup = new Map<string, string>(
      data.data.dataList.map((item) => [item.key, item.value]),
    );

    const get = (key: string): number | null => {
      const raw = lookup.get(key);
      if (raw == null || raw === '') return null;
      const n = parseFloat(raw);
      return isNaN(n) ? null : n;
    };

    const collectionTime = data.data.collectionTime;
    const recordedAt = collectionTime
      ? new Date(collectionTime * 1000).toISOString()
      : new Date().toISOString();

    // TotalPower and Pac are in W — convert to kW
    const solarPowerW = get(SOLARMAN_KEYS.TOTAL_PV_POWER);
    const acOutputW = get(SOLARMAN_KEYS.AC_OUTPUT_POWER);

    return {
      inverterId: '',
      recordedAt,
      inverterStatus: this.normaliseDeviceState(data.data.deviceState),

      solarPowerKw:
        solarPowerW != null
          ? parseFloat((solarPowerW / 1000).toFixed(3))
          : null,
      acOutputPowerKw:
        acOutputW != null ? parseFloat((acOutputW / 1000).toFixed(3)) : null,

      gridVoltageV: get(SOLARMAN_KEYS.GRID_VOLTAGE),
      gridFrequencyHz: get(SOLARMAN_KEYS.GRID_FREQUENCY),

      batterySoc: get(SOLARMAN_KEYS.BATTERY_SOC),
      batteryVoltageV: null, // not in TRD confirmed keys
      batteryCurrentA: null, // not exposed by Solarman v1
      batteryTemperatureC: null, // not exposed by Solarman v1
      batteryTimeToGoMin: null, // not exposed by Solarman v1

      inverterTemperatureC: null, // not in TRD confirmed keys

      pvString1PowerKw: null, // Solarman doesn't expose per-string data in currentData
      pvString2PowerKw: null,

      energyGeneratedTodayKwh: get(SOLARMAN_KEYS.DAILY_PV_GENERATION),
      totalEnergyGeneratedKwh: get(SOLARMAN_KEYS.TOTAL_PV_GENERATION),
      batteryChargedTodayKwh: null,
      batteryDischargedTodayKwh: null,
      gridExportTodayKwh: null,
      gridImportTodayKwh: null,
    };
  }

  private normaliseDeviceState(state: number): string {
    const map: Record<number, string> = {
      1: 'normal',
      2: 'offline',
      3: 'fault',
    };
    return map[state] ?? 'unknown';
  }
}
