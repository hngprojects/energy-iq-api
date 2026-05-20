import {
  Inject,
  Injectable,
  Logger,
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
import { AlertResolutionStatus, AlertSeverity } from '../../common/enums';
import { GetAlertsDto } from './dto/get-alerts-dto';
import { type ConfigType } from '@nestjs/config';
import { appConfig } from '../../config/app.config';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly alertAction: AlertModelAction,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  async getAlerts(dto: GetAlertsDto) {
    const findOptions: FindOptionsWhere<Alert> = {
      userId: dto.userId,
    };
    if (dto.alert_type) findOptions.type = dto.alert_type;
    return this.alertAction.find({
      findOptions,
      ...noTransaction(),
      paginationPayload: {
        limit: dto.page_size ?? 10,
        page: dto.page_number ?? 1,
      },
    });
  }

  async getAlertsSummary(userId: string): Promise<AlertSummaryDto> {
    const [
      activeAlertCount,
      criticalAlertCount,
      warningAlertCount,
      unresolvedCount,
    ] = await Promise.all([
      this.alertAction.getAlertCountWhere({
        userId,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      }),
      this.alertAction.getAlertCountWhere({
        userId,
        severity: AlertSeverity.CRITICAL,
      }),
      this.alertAction.getAlertCountWhere({
        userId,
        severity: AlertSeverity.WARNING,
      }),
      this.alertAction.getAlertCountWhere({
        userId,
        resolutionStatus: AlertResolutionStatus.UNRESOLVED,
      }),
    ]);

    return {
      active: Number(activeAlertCount),
      critical: Number(criticalAlertCount),
      unresolved: Number(unresolvedCount),
      warning: Number(warningAlertCount),
    };
  }

  async getAlertDetails(dto: GetAlertDetailsDto) {
    this.logger.log(`Fetching alert details`);
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) {
      this.logger.warn(`Alert not found`);
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }
    if (alert.userId !== dto.userId) {
      this.logger.warn(`Unauthorized alert access attempt`);
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);
    }
    return alert;
  }

  async resolveAlert(dto: ResolveAlertDetailsDto) {
    this.logger.log(`Resolving alert`);
    const alert = await this.alertAction.findById(dto.alertId);
    if (!alert) {
      this.logger.warn(`Alert not found for resolution`);
      throw new NotFoundException(SYS_MSG.NOT_FOUND);
    }
    if (alert.userId !== dto.userId) {
      this.logger.warn(`Unauthorized alert resolution attempt`);
      throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);
    }
    return this.alertAction.markAsResolved(dto.alertId);
  }
}
