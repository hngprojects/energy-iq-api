import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsDto } from './dto/reports.dto';
import { GetReportsDto } from './dto/get-reports.dto';
import { ReportStatus, ReportType } from '../../common/enums/reports.type';

@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a report' })
  @HttpCode(HttpStatus.CREATED)
  generateReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReportsDto,
  ) {
    return this.reportsService.generateReport(dto, user.sub);
  }

  @Get('')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reports for a user' })
  @ApiQuery({
    name: 'reportType',
    required: false,
    enum: ReportType,
  })
  @ApiQuery({
    name: 'pageNumber',
    required: false,
    type: 'integer',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-05-26',
    description: 'Start date for the reports to fetch',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-05-26',
    description: 'End date for the reports to fetch',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ReportStatus,
  })
  @ApiQuery({
    name: 'seriesId',
    required: false,
    type: 'string',
    format: 'uuid',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: 'integer',
  })
  @HttpCode(HttpStatus.OK)
  getReports(@CurrentUser('sub') id: string, @Query() query: GetReportsDto) {
    return this.reportsService.getReports(query, id);
  }

  @Get('summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a summary of a user's reports" })
  @HttpCode(HttpStatus.OK)
  getReportsSummary(@CurrentUser('sub') id: string) {
    return this.reportsService.getReportTypesSummary(id);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single report' })
  @HttpCode(HttpStatus.OK)
  getSingleReport(
    @CurrentUser('sub') userId: string,
    @Param('id') reportId: string,
  ) {
    return this.reportsService.getUserReport(reportId, userId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a report' })
  @HttpCode(HttpStatus.OK)
  deleteReport(
    @CurrentUser('sub') userId: string,
    @Param('id') reportId: string,
  ) {
    return this.reportsService.deleteReports(reportId, userId);
  }

  @Patch(':id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a pending report' })
  @HttpCode(HttpStatus.OK)
  cancelReport(
    @CurrentUser('sub') userId: string,
    @Param('id') reportId: string,
  ) {
    return this.reportsService.cancelReports(reportId, userId);
  }

  @Get(':id/download')
  @HttpCode(HttpStatus.OK)
  async downloadReport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { file } = await this.reportsService.downloadReport(id, user.sub);
    return file;
  }

  @Post(':id/email-report')
  @HttpCode(HttpStatus.OK)
  triggerReportEmail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.triggerReportEmail(id, user.sub);
  }
}
