import { AbstractModelAction } from '@hng-sdk/orm';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UploadedImage } from '../entities/uploaded-img.entity';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { SYS_MSG } from '../../../common/constants/sys-msg';
import { CloudinaryService } from '../cloudinary.service';

@Injectable()
export class UploadedImgModelAction extends AbstractModelAction<UploadedImage> {
  private readonly logger = new Logger(UploadedImgModelAction.name);
  constructor(
    @InjectRepository(UploadedImage) repository: Repository<UploadedImage>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    super(repository, UploadedImage);
  }

  async findByUserId(userId: string): Promise<UploadedImage | null> {
    return this.repository.findOne({
      where: { user: { id: userId } },
    });
  }

  async upsertUserPorfileImg(
    userId: string,
    fileMeta: Partial<UploadedImage>,
  ): Promise<UploadedImage> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    const user = await queryRunner.manager.findOneBy(User, { id: userId });

    if (!user) throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);

    await queryRunner.startTransaction();
    try {

      const existing = await queryRunner.manager
        .createQueryBuilder(UploadedImage, 'img')
        .setLock('pessimistic_write')
        .where('img.user.id = :userId', { userId })
        .getOne();


      await queryRunner.manager
        .createQueryBuilder(UploadedImage, 'img')
        .insert()
        .into(UploadedImage)
        .values({
          ...fileMeta,
          user: { id: userId },
        })
        .orUpdate(
          [
            'file_extname',
            'filename',
            'filesize_bytes',
            'upload_status',
            'upload_url',
            'thumbnail',
            'public_id',
            'uploaded_by_email',
          ],
          ['user_id'],
        )
        .returning('public_id')
        .execute();


      const saved = await queryRunner.manager.findOne(UploadedImage, {
        where: { user: { id: userId } },
      });

      if (!saved)
        throw new ServiceUnavailableException(SYS_MSG.ERROR_UPLOADING_IMAGE);

      if (existing?.publicId && existing.publicId !== fileMeta.publicId) {
        await this.cloudinaryService.deleteByPublicId(existing.publicId);
      }

      await queryRunner.commitTransaction();

      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error uploading img',
        err instanceof Error ? err.stack : JSON.stringify(err),
      );
      throw new ServiceUnavailableException(SYS_MSG.ERROR_UPLOADING_IMAGE);
    } finally {
      await queryRunner.release();
    }
  }
}
