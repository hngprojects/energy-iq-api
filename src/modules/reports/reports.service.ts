import { BadRequestException, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { InvertersService } from '../inverters/inverters.service';
import { InvertersMetricsService } from '../inverters-metrics/inverters-metrics.service';
import { ReportModelAction } from './action/report.action';
import {
  AlertReport,
  AnyReport,
  CostSavingsReport,
  GeneralReport,
  SolarReport,
} from './types/reports.type';
import { ReportStatus, ReportType } from '../../common/enums/reports.type';
import { AlertsService } from '../alerts/alerts.service';
import { Report } from './entities/report.entity';

@Injectable()
export class ReportsService {
  constructor(
    private readonly invertersService: InvertersService,
    private readonly usersService: UsersService,
    private readonly invertersMetricsService: InvertersMetricsService,
    private readonly reportModelAction: ReportModelAction,
    private readonly alertsService: AlertsService,
  ) {}

  async generateReport() {}

  async downloadReport() {}

  async getReportById(reportId: string): Promise<Report | null> {
    return await this.reportModelAction.findById(reportId);
  }

  async computeSolarReport(report: Report): Promise<SolarReport> {
    return await this.invertersMetricsService.getSolarReport(report);
  }

  async computeAlertReport(report: Report): Promise<AlertReport> {
    return await this.alertsService.getAlertReport(report);
  }

  async computeCostAndSavingsReport(
    report: Report,
  ): Promise<CostSavingsReport> {
    return await this.invertersMetricsService.getCostsAndSavingsReport(report);
  }

  async computeGeneralReport(report: Report): Promise<GeneralReport> {
    const [
      { keyMetrics: alertKeyMetrics },
      { keyMetrics: cscKeyMetrics },
      { keyMetrics: solarKeyMetrics },
    ] = await Promise.all([
      this.computeAlertReport(report),
      this.computeCostAndSavingsReport(report),
      this.computeSolarReport(report),
    ]);

    return {
      name: report.name,
      period: report.period,
      status: ReportStatus.READY,
      dateRequested: report.dateRequested,
      dateDelivered: new Date(),
      type: ReportType.GENERAL,
      keyMetrics: {
        ...alertKeyMetrics,
        ...cscKeyMetrics,
        ...solarKeyMetrics,
      },
    };
  }

  async updateReport(
    id: string,
    report: AnyReport,
    dateDelivered: Date | null,
  ): Promise<Report | null> {
    return await this.reportModelAction.updateReport(
      id,
      report.keyMetrics,
      dateDelivered,
      report.status,
    );
  }

  private parseDateOrThrow(value: string, field: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return d;
  }
}
