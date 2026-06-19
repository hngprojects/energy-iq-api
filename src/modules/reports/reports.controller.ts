import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsDto } from './dto/reports.dto';
import { type Response } from 'express';

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
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, report } = await this.reportsService.downloadReport(
      id,
      user.sub,
    );
    const filename = `${report.type}_${report.name}_${report.dateDelivered?.toISOString().split('T')[0]}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
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
