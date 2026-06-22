import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsDto } from './dto/reports.dto';

@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('')
  @ApiOperation({ summary: 'Generate a report' })
  @HttpCode(HttpStatus.CREATED)
  generateReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReportsDto,
  ) {
    return this.reportsService.generateReport(dto, user.sub);
  }

  @Get('download/:id')
  @HttpCode(HttpStatus.OK)
  async downloadReport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { file } = await this.reportsService.downloadReport(id, user.sub);
    return file;
  }

  @Post('email-report/:id')
  @HttpCode(HttpStatus.OK)
  triggerReportEmail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.triggerReportEmail(id, user.sub);
  }
}
