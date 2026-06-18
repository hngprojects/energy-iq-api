import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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
}
