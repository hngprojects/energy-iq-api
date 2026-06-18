import { AbstractModelAction } from '@hng-sdk/orm';
import { Report } from '../entities/report.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from '../../alerts/entities/alert.entity';
import { ReportStatus } from '../../../common/enums/reports.type';
import { ReportKeyMetrics } from '../types/reports.type';
import { noTransaction } from '../../../common/constants/transaction-options';

export class ReportModelAction extends AbstractModelAction<Report> {
  constructor(@InjectRepository(Report) repository: Repository<Report>) {
    super(repository, Alert);
  }

  async findById(id: string): Promise<Report | null> {
    return this.findById(id);
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
    dateDelivered: Date | null,
    status: ReportStatus,
  ): Promise<Report | null> {
    const updated = await this.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: {
        keyMetrics,
        dateDelivered,
        status,
      },
    });

    return updated;
  }
}
