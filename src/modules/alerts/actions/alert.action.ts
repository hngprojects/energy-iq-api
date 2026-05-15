import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { Alert } from '../entities/alert-entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  FindOptionsWhere,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { FindAlertsDto } from '../../chatbot/dto/find-alerts.dto';

@Injectable()
export class AlertModelAction extends AbstractModelAction<Alert> {
  constructor(@InjectRepository(Alert) repository: Repository<Alert>) {
    super(repository, Alert);
  }

  async findAlertsWhere(options: FindAlertsDto) {
    const whereOptions: FindOptionsWhere<Alert> = {};

    if (options.end_date)
      whereOptions.createdAt = LessThanOrEqual(options.end_date);
    if (options.platform) whereOptions.platform = options.platform;
    if (options.resolved) whereOptions.resolved = options.resolved;
    if (options.severity) whereOptions.severity = options.severity;
    if (options.start_date)
      whereOptions.createdAt = MoreThanOrEqual(options.start_date);
    if (options.type) whereOptions.type = options.type;
    if (options.severity) whereOptions.severity = options.severity;

    const queryOptions: FindManyOptions = {
      where: whereOptions,
    };
    if (options.count) queryOptions.take = options.count;

    const alerts = await this.repository.find(queryOptions);
    return alerts;
  }
}
