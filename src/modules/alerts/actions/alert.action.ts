import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { Alert } from '../entities/alert.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  FindOptionsWhere,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { FindAlertsDto } from '../../chatbot/dto/find-alerts.dto';
import { AlertResolutionStatus } from '../../../common/enums';
import { noTransaction } from '../../../common/constants/transaction-options';

@Injectable()
export class AlertModelAction extends AbstractModelAction<Alert> {
  constructor(@InjectRepository(Alert) repository: Repository<Alert>) {
    super(repository, Alert);
  }

  async createalert(alert: Partial<Alert>) {
    return this.create({
      ...noTransaction(),
      createPayload: alert,
    });
  }

  findById(id: string) {
    return this.get({
      identifierOptions: {
        id,
      },
    });
  }

  findByUserId(userId: string) {
    return this.list({
      filterRecordOptions: { userId },
    });
  }

  async findAlertsWhere(options: FindAlertsDto) {
    const whereOptions: FindOptionsWhere<Alert> = {};

    if (options.end_date)
      whereOptions.createdAt = LessThanOrEqual(options.end_date);
    if (options.platform) whereOptions.platform = options.platform;
    if (options.resolved)
      whereOptions.resolutionStatus = AlertResolutionStatus.RESOLVED;
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

  async findAlertsSinceTimestampWhere(
    timestamp: Date,
    options: Partial<Alert>,
  ) {
    const whereOptions: FindOptionsWhere<Alert> = {
      createdAt: MoreThanOrEqual(timestamp),
      userId: options.userId,
    };

    if (options.platform) whereOptions.platform = options.platform;
    if (options.resolutionStatus)
      whereOptions.resolutionStatus = options.resolutionStatus;
    if (options.severity) whereOptions.severity = options.severity;
    if (options.type) whereOptions.type = options.type;
    if (options.severity) whereOptions.severity = options.severity;

    const queryOptions: FindManyOptions = {
      where: whereOptions,
    };

    const alerts = await this.repository.find(queryOptions);
    return alerts;
  }

  getAlertCountWhere(options: Partial<Alert>) {
    const findOptions = options as FindOptionsWhere<Alert>;
    return this.repository.countBy(findOptions);
  }

  markAsResolved(alertId: string) {
    return this.update({
      identifierOptions: { id: alertId },
      updatePayload: { resolutionStatus: AlertResolutionStatus.RESOLVED },
      ...noTransaction(),
    });
  }
}
