import { Injectable } from '@nestjs/common';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { InvertersMetrics } from '../entities/inverters-metrics.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { AbstractModelAction } from '@hng-sdk/orm';

@Injectable()
export class InverterMetricsModelAction extends AbstractModelAction<InvertersMetrics> {
  constructor(
    @InjectRepository(InvertersMetrics)
    repository: Repository<InvertersMetrics>,
  ) {
    super(repository, InvertersMetrics);
  }

  getMetricsCreatedSince(since: Date): Promise<InvertersMetrics[]> {
    return this.repository.find({
      where: { metricTimestamp: MoreThanOrEqual(since) },
      relations: { inverter: true },
    });
  }
}
