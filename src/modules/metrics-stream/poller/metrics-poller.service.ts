import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VictronAdapter } from '../../inverters/adapters/victron.adapters';
import { GrowattAdapter } from '../../inverters/adapters/growatt.adapter';
import { SunsynkAdapter } from '../../inverters/adapters/sunsynk.adapter';
import { InverterModelAction } from '../../inverters/action/inverters.action';
import { InvertersMetrics } from '../../inverters-metrics/entities/inverters-metrics.entity';
import { MetricsPubSubService } from '../pubsub/metrics-pubsub.service';
import { InverterBrand } from '../../../common/enums';
import { Inverter } from '../../inverters/entities/inverters.entity';
import { NormalisedMetric } from '../../inverters/types/shared.types';
import { SecretManager } from '../../../common/utils/crypto.utils';

const VICTRON_POLL_MS = 120_000; // 2 min
const GROWATT_POLL_MS = 300_000; // 5 min
const SUNSYNK_POLL_MS = 300_000; // 5 min

@Injectable()
export class MetricsPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsPollerService.name);

  private victronInverters: Inverter[] = [];
  private growattInverters: Inverter[] = [];
  private sunsynkInverters: Inverter[] = [];

  constructor(
    private readonly victronAdapter: VictronAdapter,
    private readonly growattAdapter: GrowattAdapter,
    private readonly sunsynkAdapter: SunsynkAdapter,
    private readonly inverterModelAction: InverterModelAction,
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepo: Repository<InvertersMetrics>,
    private readonly pubSubService: MetricsPubSubService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadInverters();
  }

  onModuleDestroy(): void {
    this.logger.log('MetricsPollerService: shutting down');
  }

  @Interval(VICTRON_POLL_MS)
  async pollVictron(): Promise<void> {
    if (!this.victronInverters.length) return;
    await Promise.allSettled(
      this.victronInverters.map((inv) => this.pollVictronOne(inv)),
    );
  }

  @Interval(GROWATT_POLL_MS)
  async pollGrowatt(): Promise<void> {
    if (!this.growattInverters.length) return;
    await Promise.allSettled(
      this.growattInverters.map((inv) => this.pollGrowattOne(inv)),
    );
  }

  @Interval(SUNSYNK_POLL_MS)
  async pollSunsynk(): Promise<void> {
    if (!this.sunsynkInverters.length) return;
    await Promise.allSettled(
      this.sunsynkInverters.map((inv) => this.pollSunsynkOne(inv)),
    );
  }

  private async loadInverters(): Promise<void> {
    [this.victronInverters, this.growattInverters, this.sunsynkInverters] =
      await Promise.all([
        this.inverterModelAction.findSpecificBrand(InverterBrand.VICTRON),
        this.inverterModelAction.findSpecificBrand(InverterBrand.GROWATT),
        this.inverterModelAction.findSpecificBrand(InverterBrand.SUNSYNK),
      ]);

    this.logger.log(
      `MetricsPollerService: loaded ${this.victronInverters.length} Victron, ` +
        `${this.growattInverters.length} Growatt, ${this.sunsynkInverters.length} Sunsynk inverters`,
    );
  }

  private async pollVictronOne(inverter: Inverter): Promise<void> {
    let accessToken: string;
    try {
      accessToken = SecretManager.decrypt(inverter.encryptedCredentials!);
    } catch (err) {
      this.logger.error(
        `Victron decrypt failed for ${inverter.id}`,
        (err as Error).message,
      );
      return;
    }

    let metric: NormalisedMetric;
    try {
      metric = await this.victronAdapter.fetchMetrics(
        accessToken,
        inverter.installationId!,
        inverter.id,
      );
    } catch (err) {
      this.logger.error(
        `Victron fetch failed for ${inverter.id}`,
        (err as Error).message,
      );
      return;
    }

    await this.persistAndPublish(metric, inverter.id);
  }

  private async pollGrowattOne(inverter: Inverter): Promise<void> {
    let apiToken: string;
    try {
      apiToken = SecretManager.decrypt(inverter.encryptedCredentials!);
    } catch (err) {
      this.logger.error(
        `Growatt decrypt failed for ${inverter.id}`,
        (err as Error).message,
      );
      return;
    }

    // brandDeviceId stores the device_sn for Growatt
    const deviceSn = inverter.installationId!;

    let metric: NormalisedMetric;
    try {
      metric = await this.growattAdapter.fetchMetrics(deviceSn, apiToken);
      metric = { ...metric, inverterId: inverter.id };
    } catch (err) {
      this.logger.error(
        `Growatt fetch failed for ${inverter.id}`,
        (err as Error).message,
      );
      return;
    }

    await this.persistAndPublish(metric, inverter.id);
  }

  private async pollSunsynkOne(inverter: Inverter): Promise<void> {
    // Credentials stored as "email:password"
    let email: string;
    let password: string;
    try {
      const raw = SecretManager.decrypt(inverter.encryptedCredentials!);
      const colonIdx = raw.indexOf(':');
      email = raw.slice(0, colonIdx);
      password = raw.slice(colonIdx + 1);
    } catch (err) {
      this.logger.error(
        `Sunsynk decrypt failed for ${inverter.id}`,
        (err as Error).message,
      );
      return;
    }

    const deviceSn = inverter.serialNumber;

    let metric: NormalisedMetric;
    try {
      metric = await this.sunsynkAdapter.fetchMetrics(
        deviceSn,
        email,
        password,
      );
      metric = { ...metric, inverterId: inverter.id };
    } catch (err) {
      this.logger.error(
        `Sunsynk fetch failed for ${inverter.id}`,
        (err as Error).message,
      );
      return;
    }

    await this.persistAndPublish(metric, inverter.id);
  }

  private async persistAndPublish(
    metric: NormalisedMetric,
    inverterId: string,
  ): Promise<void> {
    try {
      await this.metricsRepo.save(
        this.metricsRepo.create({
          inverterId: metric.inverterId,
          solarGenKw: metric.solarPowerKw ?? 0,
          batterySocPercent: metric.batterySoc ?? 0,
          loadKw: metric.acOutputPowerKw ?? 0,
          gridVoltageV: metric.gridVoltageV ?? undefined,
          gridFrequencyHz: metric.gridFrequencyHz ?? undefined,
          batteryVoltageV: metric.batteryVoltageV ?? undefined,
          batteryCurrentA: metric.batteryCurrentA ?? undefined,
          inverterStatus: metric.inverterStatus,
          batteryTemperatureC: metric.batteryTemperatureC ?? undefined,
          batteryTimeToGoMin: metric.batteryTimeToGoMin ?? undefined,
          inverterTemperatureC: metric.inverterTemperatureC ?? undefined,
          metricTimestamp: new Date(metric.recordedAt),
        }),
      );
    } catch (err) {
      this.logger.error(
        `DB write failed for inverter ${inverterId}`,
        (err as Error).message,
      );
      return;
    }

    try {
      await this.pubSubService.publish(
        `inverter:${metric.inverterId}`,
        JSON.stringify(metric),
      );
    } catch (err) {
      this.logger.error(
        `Redis publish failed for inverter ${inverterId}`,
        (err as Error).message,
      );
    }
  }
}
