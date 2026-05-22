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
import { SandboxAdapter } from '../../inverters/adapters/sandbox.adapter';
import { InverterModelAction } from '../../inverters/action/inverters.action';
import { InvertersMetrics } from '../../inverters-metrics/entities/inverters-metrics.entity';
import { MetricsPubSubService } from '../pubsub/metrics-pubsub.service';
import { InverterBrand } from '../../../common/enums';
import { Inverter } from '../../inverters/entities/inverters.entity';
import { NormalisedMetric } from '../../inverters/types/shared.types';
import { SecretManager } from '../../../common/utils/crypto.utils';
import {
  INVERTER_CONTROL_CHANNEL,
  InverterControlMessage,
} from '../../../common/constants/queue';

const VICTRON_POLL_MS = 120_000; // 2 min
const GROWATT_POLL_MS = 300_000; // 5 min
const SUNSYNK_POLL_MS = 300_000; // 5 min
const SANDBOX_POLL_MS = 30_000; // 30 seconds — matches mock server tick interval

@Injectable()
export class MetricsPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsPollerService.name);

  private victronInverters: Inverter[] = [];
  private growattInverters: Inverter[] = [];
  private sunsynkInverters: Inverter[] = [];
  private sandboxInverters: Inverter[] = [];

  private failureCounts = new Map<string, number>();

  constructor(
    private readonly victronAdapter: VictronAdapter,
    private readonly growattAdapter: GrowattAdapter,
    private readonly sunsynkAdapter: SunsynkAdapter,
    private readonly sandboxAdapter: SandboxAdapter,
    private readonly inverterModelAction: InverterModelAction,
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepo: Repository<InvertersMetrics>,
    private readonly pubSubService: MetricsPubSubService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadInverters();
    await this.subscribeToControlChannel();
  }

  onModuleDestroy(): void {
    this.logger.log('MetricsPollerService: shutting down');
  }

  // Dynamic registration

  private async subscribeToControlChannel(): Promise<void> {
    await this.pubSubService.subscribe(
      INVERTER_CONTROL_CHANNEL,
      (raw: string) => {
        let msg: unknown;
        try {
          msg = JSON.parse(raw);
        } catch {
          this.logger.warn(
            `MetricsPollerService: malformed control message: ${raw}`,
          );
          return;
        }

        if (!this.isValidControlMessage(msg)) {
          this.logger.warn(
            `MetricsPollerService: invalid control message shape`,
          );
          return;
        }

        if (msg.event === 'registered') {
          void this.handleInverterRegistered(msg.inverterId);
        } else if (msg.event === 'deregistered') {
          this.handleInverterDeregistered(msg.inverterId);
        } else {
          // Exhaustive guard — unknown event from a future version of the publisher
          this.logger.warn(
            'MetricsPollerService: unknown control event received',
          );
        }
      },
    );
    this.logger.log(
      `MetricsPollerService: subscribed to ${INVERTER_CONTROL_CHANNEL}`,
    );
  }

  private isValidControlMessage(msg: unknown): msg is InverterControlMessage {
    if (!msg || typeof msg !== 'object') return false;
    const m = msg as Partial<InverterControlMessage>;
    return (
      (m.event === 'registered' || m.event === 'deregistered') &&
      typeof m.inverterId === 'string' &&
      m.inverterId.length > 0 &&
      typeof m.brand === 'string'
    );
  }

  async handleInverterRegistered(inverterId: string): Promise<void> {
    const inverter = await this.inverterModelAction.get({
      identifierOptions: { id: inverterId },
    });

    if (!inverter) {
      this.logger.warn(
        `MetricsPollerService: received registered event for unknown inverter ${inverterId}`,
      );
      return;
    }

    // Guard against duplicate registration (e.g. multiple API instances)
    const alreadyTracked = this.getArrayForBrand(inverter.brand).some(
      (i) => i.id === inverterId,
    );
    if (alreadyTracked) {
      this.logger.debug(
        `MetricsPollerService: inverter ${inverterId} already tracked — skipping`,
      );
      return;
    }

    this.getArrayForBrand(inverter.brand).push(inverter);
    this.logger.log(
      `MetricsPollerService: dynamically registered inverter ${inverterId} (${inverter.brand})`,
    );
  }

  handleInverterDeregistered(inverterId: string): void {
    for (const brand of Object.values(InverterBrand)) {
      const arr = this.getArrayForBrand(brand);
      const idx = arr.findIndex((i) => i.id === inverterId);
      if (idx !== -1) {
        arr.splice(idx, 1);
        this.failureCounts.delete(inverterId);
        this.logger.log(
          `MetricsPollerService: deregistered inverter ${inverterId} (${brand})`,
        );
        return;
      }
    }
    this.logger.debug(
      `MetricsPollerService: deregister called for untracked inverter ${inverterId}`,
    );
  }

  private getArrayForBrand(brand: InverterBrand): Inverter[] {
    switch (brand) {
      case InverterBrand.VICTRON:
        return this.victronInverters;
      case InverterBrand.GROWATT:
        return this.growattInverters;
      case InverterBrand.SUNSYNK:
        return this.sunsynkInverters;
      case InverterBrand.SANDBOX:
        return this.sandboxInverters;
      default:
        return [];
    }
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

  @Interval(SANDBOX_POLL_MS)
  async pollSandbox(): Promise<void> {
    if (!this.sandboxInverters.length) return;
    await Promise.allSettled(
      this.sandboxInverters.map((inv) => this.pollSandboxOne(inv)),
    );
  }

  private async loadInverters(): Promise<void> {
    [
      this.victronInverters,
      this.growattInverters,
      this.sunsynkInverters,
      this.sandboxInverters,
    ] = await Promise.all([
      this.inverterModelAction.findSpecificBrand(InverterBrand.VICTRON),
      this.inverterModelAction.findSpecificBrand(InverterBrand.GROWATT),
      this.inverterModelAction.findSpecificBrand(InverterBrand.SUNSYNK),
      this.inverterModelAction.findSpecificBrand(InverterBrand.SANDBOX),
    ]);

    this.logger.log(
      `MetricsPollerService: loaded ${this.victronInverters.length} Victron, ` +
        `${this.growattInverters.length} Growatt, ${this.sunsynkInverters.length} Sunsynk, ` +
        `${this.sandboxInverters.length} Sandbox inverters`,
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
      this.failureCounts.set(inverter.id, 0);
      await this.inverterModelAction.markOnline(inverter.id);
    } catch (err) {
      this.logger.error(
        `Victron fetch failed for ${inverter.id}`,
        (err as Error).message,
      );
      const fetchInverterFailures = this.failureCounts.get(inverter.id) ?? 0;
      this.failureCounts.set(inverter.id, fetchInverterFailures + 1);

      if (fetchInverterFailures >= 2) {
        await this.inverterModelAction.markOffline(inverter.id);
      }
      return;
    }

    await this.persistAndPublish(metric, inverter.id);
  }

  private async pollSandboxOne(inverter: Inverter): Promise<void> {
    let accessToken: string;
    try {
      accessToken = SecretManager.decrypt(inverter.encryptedCredentials!);
    } catch (err) {
      this.logger.error(
        `Sandbox decrypt failed for ${inverter.id}`,
        (err as Error).message,
      );
      return;
    }

    let metric: NormalisedMetric;
    try {
      metric = await this.sandboxAdapter.fetchMetrics(
        accessToken,
        inverter.installationId!,
        inverter.id,
      );
      this.failureCounts.set(inverter.id, 0);
      await this.inverterModelAction.markOnline(inverter.id);
    } catch (err) {
      this.logger.error(
        `Sandbox fetch failed for ${inverter.id}`,
        (err as Error).message,
      );
      const fetchInverterFailures = this.failureCounts.get(inverter.id) ?? 0;
      this.failureCounts.set(inverter.id, fetchInverterFailures + 1);

      if (fetchInverterFailures >= 2) {
        await this.inverterModelAction.markOffline(inverter.id);
      }
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
      this.failureCounts.set(inverter.id, 0);
      await this.inverterModelAction.markOnline(inverter.id);
    } catch (err) {
      this.logger.error(
        `Growatt fetch failed for ${inverter.id}`,
        (err as Error).message,
      );
      const fetchInverterFailures = this.failureCounts.get(inverter.id) ?? 0;
      this.failureCounts.set(inverter.id, fetchInverterFailures + 1);

      if (fetchInverterFailures >= 2) {
        await this.inverterModelAction.markOffline(inverter.id);
      }
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
      this.failureCounts.set(inverter.id, 0);
      await this.inverterModelAction.markOnline(inverter.id);
    } catch (err) {
      this.logger.error(
        `Sunsynk fetch failed for ${inverter.id}`,
        (err as Error).message,
      );
      const fetchInverterFailures = this.failureCounts.get(inverter.id) ?? 0;
      this.failureCounts.set(inverter.id, fetchInverterFailures + 1);

      if (fetchInverterFailures >= 2) {
        await this.inverterModelAction.markOffline(inverter.id);
      }
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
