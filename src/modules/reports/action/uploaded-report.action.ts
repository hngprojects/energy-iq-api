import { AbstractModelAction } from '@hng-sdk/orm';
import { UploadedReport } from '../entities/uploaded-report.entity';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import { User } from '../../users/entities/user.entity';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SYS_MSG } from '../../../common/constants/sys-msg';

export class UploadedReportModelAction extends AbstractModelAction<UploadedReport> {
  constructor(
    @InjectRepository(UploadedReport) repository: Repository<UploadedReport>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    super(repository, UploadedReport);
  }

  async findByReportId(reportId: string): Promise<UploadedReport | null> {
    return this.repository.findOne({
      where: { reportId },
    });
  }

  async findByShareToken(shareToken: string): Promise<UploadedReport | null> {
    return this.repository.findOne({
      where: { shareToken },
    });
  }

  async upsertUploadedReport(
    reportId: string,
    fileMeta: Partial<UploadedReport>,
  ): Promise<{
    uploadedReport: UploadedReport;
    existingUploadedReport: UploadedReport | null;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      const user = await queryRunner.manager.findOneBy(User, {
        id: fileMeta.userId,
      });
      if (!user) throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);

      await queryRunner.startTransaction();

      const existing = await queryRunner.manager
        .createQueryBuilder(UploadedReport, 'hostedReport')
        .setLock('pessimistic_write')
        .where('hostedReport.reportId = :reportId', { reportId })
        .getOne();

      // If the link exists and not expired, we might still want to updateit

      let saved: UploadedReport;

      if (existing) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(UploadedReport)
          .set(fileMeta)
          .where('id = :id', { id: existing.id })
          .execute();

        saved = await queryRunner.manager.findOneOrFail(UploadedReport, {
          where: { id: existing.id },
        });
      } else {
        const newReport = queryRunner.manager.create(UploadedReport, fileMeta);
        saved = await queryRunner.manager.save(newReport);
      }

      await queryRunner.commitTransaction();
      return { uploadedReport: saved, existingUploadedReport: existing };
    } catch {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw new ServiceUnavailableException(SYS_MSG.ERROR_GENERATING_SHAREABLE);
    } finally {
      await queryRunner.release();
    }
  }
}
