import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import {
  MeResponse,
  VictronDiagnosticsResponse,
  VictronInstallationsResponse,
} from '../types/victron.types';
import { NormalisedMetric, VerifiedSystem } from '../types/shared.types';
import { BrandApiException } from '../types/brand-api.exception';
import { appConfig } from '../../../config/app.config';
import { InverterBrand } from '../../../common/enums';

@Injectable()
export class VictronAdapter {
  constructor(
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  async verifyAndGetVictronSystem(
    accessToken: string,
  ): Promise<VerifiedSystem> {
    const meRes = await fetch(`${this.appCfg.victronApiBaseUrl}/users/me`, {
      headers: { 'X-Authorization': `Token ${accessToken}` },
    });

    if (!meRes.ok) {
      throw new BadRequestException(
        'Could not connect to your Victron VRM account. Check your access token.',
      );
    }

    const me = (await meRes.json()) as MeResponse;
    const idUser = me?.record?.idUser;

    const instRes = await fetch(
      `${this.appCfg.victronApiBaseUrl}/users/${idUser}/installations`,
      {
        headers: { 'X-Authorization': `Token ${accessToken}` },
      },
    );

    const data = (await instRes.json()) as VictronInstallationsResponse;

    if (!data.success || !data.records?.length) {
      throw new BadRequestException(
        'No installations found on your Victron VRM account.',
      );
    }

    const site = data.records[0];

    return {
      model: site.name,
      serialNumber: site.identifier,
      installationId: String(site.idSite),
      ratedCapacityKwh: site.pvMax
        ? parseFloat((site.pvMax / 1000).toFixed(2))
        : 0,
      timezone: site.timezone,
      isOnGrid: site.is_on_grid,
      hasGenerator: Boolean(site.hasGenerator),
      mqttHost: site.mqtt_host,
    };
  }

  /**
   * Called on every poll cycle to fetch live metrics for a registered inverter.
   * Uses the VRM diagnostics endpoint — returns a flat array of attribute objects
   * keyed by `code`. Values include units in `formattedValue` (e.g. "82%", "1.2kW").
   */
  async fetchMetrics(
    accessToken: string,
    installationId: string,
    inverterId: string,
  ): Promise<NormalisedMetric> {
    const res = await fetch(
      `${this.appCfg.victronApiBaseUrl}/installations/${installationId}/diagnostics`,
      { headers: { 'X-Authorization': `Token ${accessToken}` } },
    );

    if (!res.ok) {
      throw new BrandApiException(
        res.status,
        `Victron VRM diagnostics request failed for installation ${installationId}`,
      );
    }

    const data = (await res.json()) as VictronDiagnosticsResponse;
    const records = data.records ?? [];

    // Strip units from formattedValue and parse as float. Returns null if absent or NaN.
    const getFloat = (code: string): number | null => {
      const attr = records.find((a) => a.code === code);
      if (!attr?.formattedValue) return null;
      const val = parseFloat(attr.formattedValue.replace(/[^0-9.-]/g, ''));
      return isNaN(val) ? null : val;
    };

    const getString = (code: string): string | null => {
      const attr = records.find((a) => a.code === code);
      return attr?.formattedValue ?? null;
    };

    return {
      inverterId,
      inverterBrand: InverterBrand.VICTRON,
      recordedAt: new Date().toISOString(),
      inverterStatus: getString('S') ?? 'unknown',
      solarPowerKw: getFloat('Pdc'),
      acOutputPowerKw: getFloat('Pac'),
      gridVoltageV: getFloat('Gv'),
      gridFrequencyHz: getFloat('Gf'),
      batterySoc: getFloat('bs'),
      batteryVoltageV: getFloat('bv'),
      batteryCurrentA: getFloat('Bc'),
      batteryTemperatureC: getFloat('Tb'),
      batteryTimeToGoMin: getFloat('Ttg'),
      inverterTemperatureC: getFloat('Ti'),
      pvString1PowerKw: null,
      pvString2PowerKw: null,
      energyGeneratedTodayKwh: null,
      totalEnergyGeneratedKwh: null,
      batteryChargedTodayKwh: null,
      batteryDischargedTodayKwh: null,
      gridExportTodayKwh: null,
      gridImportTodayKwh: null,
    };
  }
}
