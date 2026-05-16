import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AlertModelAction } from './actions/alert.action';
import { GetAlertDetailsDto } from './dto/get-alert-details.dto';
import { FindOptionsWhere } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { noTransaction } from '../../common/constants/transaction-options';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { ResolveAlertDetailsDto } from './dto/resolve-alert.dto';
import { AlertSummaryDto } from './dto/alert-summary.dto';
import { AlertResolutionStatus } from './enums/resolution-status.enum';
import { AlertSeverity } from './enums/severity.enum';

export class GetAlertsDto {
  alert_type?: string;
  page_number?: number;
  page_size: number;
  userId: string;
}

@Injectable()
export class AlertsService {
  constructor(private readonly alertAction: AlertModelAction) {}

  async getAlerts(dto: GetAlertsDto) {
    const findOptions: FindOptionsWhere<Alert> = {
      userId: dto.userId,
    };
    if (dto.alert_type) findOptions.type = dto.alert_type;
    const alerts = await this.alertAction.find({
      findOptions,
      ...noTransaction(),
      paginationPayload: {
        limit: dto.page_size ?? 10,
        page: dto.page_number ?? 1,
      },
    });
    return alerts;
  }

  async getAlertsSummary(userId: string): Promise<AlertSummaryDto> {
    const activeAlertCount = await this.alertAction.getAlertCountWhere({
      userId,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
    });
    const criticalAlertCount = await this.alertAction.getAlertCountWhere({
      userId,
      severity: AlertSeverity.CRITICAL,
    });
    const warningAlertCount = await this.alertAction.getAlertCountWhere({
      userId,
      severity: AlertSeverity.WARNING,
    });
    const unresolvedCount = await this.alertAction.getAlertCountWhere({
      userId,
      resolutionStatus: AlertResolutionStatus.UNRESOLVED,
    });
    return {
      active: Number(activeAlertCount),
      critical: Number(criticalAlertCount),
      unresolved: Number(unresolvedCount),
      warning: Number(warningAlertCount),
    };
  }

  async getAlertDetails(dto: GetAlertDetailsDto) {
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) throw new NotFoundException(SYS_MSG.NOT_FOUND);

    if (alert?.userId !== dto.userId)
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);

    return alert;
  }

  async resolveAlert(dto: ResolveAlertDetailsDto) {
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) throw new NotFoundException(SYS_MSG.NOT_FOUND);

    if (alert?.userId !== dto.userId)
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);

    return await this.alertAction.markAsResolved(dto.alertId);
  }
}
