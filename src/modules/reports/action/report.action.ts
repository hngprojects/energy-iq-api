import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { Report } from '../entities/report.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindManyOptions,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ReportStatus, ReportType } from '../../../common/enums/reports.type';
import { ReportKeyMetrics } from '../types/reports.type';
import { noTransaction } from '../../../common/constants/transaction-options';

interface FindReportsOptions {
  count?: number;
  endDate?: Date;
  status?: ReportStatus;
  startDate?: Date;
  type: ReportType;
}

@Injectable()
export class ReportModelAction extends AbstractModelAction<Report> {
  constructor(@InjectRepository(Report) repository: Repository<Report>) {
    super(repository, Report);
  }

  async findById(id: string): Promise<Report | null> {
    return this.get({ identifierOptions: { id } });
  }

  async findByUserId(userId: string): Promise<Report[]> {
    return this.repository.find({
      where: { userId },
    });
  }

  async findReportsWhere(
    options: FindReportsOptions,
    userId: string,
  ): Promise<Report[]> {
    const whereOptions: FindOptionsWhere<Report> = {
      userId,
    };

    if (options.startDate && options.endDate) {
      whereOptions.createdAt = Between(options.startDate, options.endDate);
    } else if (options.endDate) {
      whereOptions.createdAt = LessThanOrEqual(options.endDate);
    } else if (options.startDate) {
      whereOptions.createdAt = MoreThanOrEqual(options.startDate);
    }

    if (options.status) whereOptions.status = options.status;
    if (options.type) whereOptions.type = options.type;

    const queryOptions: FindManyOptions = {
      where: whereOptions,
    };
    if (options.count) queryOptions.take = options.count;

    const reports = await this.repository.find(queryOptions);
    return reports;
  }

  getReportCountWhere(options: FindOptionsWhere<Report>) {
    return this.repository.countBy(options);
  }

  findByStatus(status: ReportStatus): Promise<Report[]> {
    return this.repository.find({
      where: { status },
    });
  }

  async updateReport(
    id: string,
    keyMetrics: ReportKeyMetrics,
    status: ReportStatus,
    dateDelivered: Date | null,
  ): Promise<Report | null> {
    const updated = await this.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: {
        keyMetrics,
        status,
        ...(dateDelivered && { dateDelivered }),
      },
    });

    return updated;
  }

  async updateReportStatusUnconditional(
    id: string,
    status: ReportStatus,
  ): Promise<void> {
    await this.repository.update({ id }, { status });
  }

  async updateReportStatus(
    id: string,
    status: ReportStatus,
  ): Promise<Report | null> {
    // Atomic conditional update: only transitions FROM PENDING to prevent TOCTOU races.
    // Uses affected row count — if 0 rows updated, another worker already claimed it.
    const result = await this.repository.update(
      { id, status: ReportStatus.PENDING },
      { status },
    );

    if (!result.affected) return null;

    return this.findById(id);
  }

  async resetStalledProcessingReports(
    olderThanMinutes: number,
  ): Promise<number> {
    // Recovers reports stuck in PROCESSING due to worker crashes.
    // Any report still PROCESSING after olderThanMinutes is reset to PENDING
    // so the next scheduled job can pick it up again.
    const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    const result = await this.repository
      .createQueryBuilder()
      .update(Report)
      .set({ status: ReportStatus.PENDING })
      .where('status = :status', { status: ReportStatus.PROCESSING })
      .andWhere('updated_at < :threshold', { threshold })
      .execute();

    return result.affected ?? 0;
  }
}
