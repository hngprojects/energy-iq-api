import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { InvertersService } from '../inverters/inverters.service';
import { MetricsPubSubService } from './pubsub/metrics-pubsub.service';
import { InvertersMetrics } from '../inverters-metrics/entities/inverters-metrics.entity';
import { toMetricEvent } from './serializer/metric-event.serializer';
import { NormalisedMetric } from '../inverters/types/shared.types';

@Injectable()
export class MetricsStreamService {
  private readonly logger = new Logger(MetricsStreamService.name);

  constructor(
    private readonly invertersService: InvertersService,
    private readonly pubSubService: MetricsPubSubService,
    @InjectRepository(InvertersMetrics)
    private readonly metricsRepo: Repository<InvertersMetrics>,
  ) {}

  async findInverterForUser(inverterId: string, userId: string) {
    const inverter = await this.invertersService.findOne(inverterId);
    if (inverter.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this inverter stream.',
      );
    }
    return inverter;
  }

  async streamMetrics(
    inverterId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const channel = `inverter:${inverterId}`;

    // Initial snapshot from DB
    try {
      const latest = await this.metricsRepo.findOne({
        where: { inverterId },
        order: { metricTimestamp: 'DESC' },
      });
      const inv = await this.invertersService.findOne(inverterId);
      if (latest) {
        const snapshot: NormalisedMetric = {
          inverterId: latest.inverterId,
          inverterBrand: inv.brand,
          recordedAt: latest.metricTimestamp.toISOString(),
          inverterStatus: latest.inverterStatus ?? 'unknown',
          batterySoc:
            latest.batterySocPercent != null
              ? Number(latest.batterySocPercent)
              : null,
          solarPowerKw:
            latest.solarGenKw != null ? Number(latest.solarGenKw) : null,
          acOutputPowerKw: latest.loadKw != null ? Number(latest.loadKw) : null,
          gridVoltageV:
            latest.gridVoltageV != null ? Number(latest.gridVoltageV) : null,
          gridFrequencyHz:
            latest.gridFrequencyHz != null
              ? Number(latest.gridFrequencyHz)
              : null,
          batteryVoltageV:
            latest.batteryVoltageV != null
              ? Number(latest.batteryVoltageV)
              : null,
          batteryCurrentA:
            latest.batteryCurrentA != null
              ? Number(latest.batteryCurrentA)
              : null,
          batteryTemperatureC:
            latest.batteryTemperatureC != null
              ? Number(latest.batteryTemperatureC)
              : null,
          batteryTimeToGoMin:
            latest.batteryTimeToGoMin != null
              ? Number(latest.batteryTimeToGoMin)
              : null,
          inverterTemperatureC:
            latest.inverterTemperatureC != null
              ? Number(latest.inverterTemperatureC)
              : null,
          pvString1PowerKw: null,
          pvString2PowerKw: null,
          energyGeneratedTodayKwh: null,
          totalEnergyGeneratedKwh: null,
          batteryChargedTodayKwh: null,
          batteryDischargedTodayKwh: null,
          gridExportTodayKwh: null,
          gridImportTodayKwh: null,
        };
        res.write(
          `event: metric_update\ndata: ${JSON.stringify(toMetricEvent(snapshot))}\n\n`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to fetch initial snapshot for inverter ${inverterId}`,
        (err as Error).message,
      );
    }

    // Subscribe to live Redis channel
    const onMessage = (message: string): void => {
      try {
        const metric = JSON.parse(message) as NormalisedMetric;
        res.write(
          `event: metric_update\ndata: ${JSON.stringify(toMetricEvent(metric))}\n\n`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to parse message on channel ${channel}`,
          (err as Error).message,
        );
      }
    };

    await this.pubSubService.subscribe(channel, onMessage);

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':\n\n');
    }, 30_000);

    // Redis error → close stream gracefully
    const onRedisError = (err: Error): void => {
      this.logger.error(
        `Redis subscriber error for inverter ${inverterId}`,
        err.message,
      );
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: 'stream_error' })}\n\n`,
      );
      res.end();
    };
    this.pubSubService.once('error', onRedisError);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      this.pubSubService.removeListener('error', onRedisError);
      void this.pubSubService.unsubscribe(channel, onMessage);
      this.logger.log(`Client disconnected from inverter ${inverterId} stream`);
    });
  }
}
