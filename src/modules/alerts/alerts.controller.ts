import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { GetAlertsQueryDto } from './dto/get-alerts-query.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all the alerts a user has had in the past' })
  @HttpCode(HttpStatus.OK)
  getAlerts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetAlertsQueryDto,
  ) {
    return this.alertsService.getAlerts({ ...query, userId: user.sub });
  }

  @Get('summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a summary of a user's alert details" })
  @HttpCode(HttpStatus.OK)
  getAlertsSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.alertsService.getAlertsSummary(user.sub);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the details of a single alert' })
  @HttpCode(HttpStatus.OK)
  getAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) alertId: string,
  ) {
    return this.alertsService.getAlertDetails({ alertId, userId: user.sub });
  }

  @Patch(':id/resolve')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark an alert as resolved' })
  @HttpCode(HttpStatus.OK)
  resolveAlert(
    @Param('id', ParseUUIDPipe) alertId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.alertsService.resolveAlert({ alertId, userId: user.sub });
  }
}
