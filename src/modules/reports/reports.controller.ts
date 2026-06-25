import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsDto } from './dto/reports.dto';
import { GetReportsDto } from './dto/get-reports.dto';

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
  @HttpCode(HttpStatus.OK)
  getReports(@CurrentUser('sub') id: string, @Query() query: GetReportsDto) {
    return this.reportsService.getReports(query, id);
  }

  @Get('summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a sumary of a user's reports" })
  @HttpCode(HttpStatus.OK)
  getReportsSummary(@CurrentUser('sub') id: string) {
    return this.reportsService.getReportTypesSummary(id);
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
