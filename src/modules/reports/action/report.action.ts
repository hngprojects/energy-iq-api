import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { Report } from '../entities/report.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportStatus } from '../../../common/enums/reports.type';
import { ReportKeyMetrics } from '../types/reports.type';
import { noTransaction } from '../../../common/constants/transaction-options';

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

  async findByStatus(status: ReportStatus): Promise<Report[]> {
    return this.repository.find({
      where: { status },
    });
  }

  async updateReport(
    id: string,
    keyMetrics: ReportKeyMetrics,
    status: ReportStatus,
    dateDelivered: Date,
  ): Promise<Report | null> {
    const updated = await this.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: {
        keyMetrics,
        status,
        dateDelivered,
      },
    });

    return updated;
  }
}
