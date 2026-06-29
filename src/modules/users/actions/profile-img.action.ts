import { AbstractModelAction } from '@hng-sdk/orm';
import { ProfileImage } from '../entities/profile-img.entity';
import {
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import { User } from '../entities/user.entity';
import { SYS_MSG } from '../../../common/constants/sys-msg';

export class ProfileImageModelAction extends AbstractModelAction<ProfileImage> {
  private readonly logger = new Logger(ProfileImageModelAction.name);

  constructor(
    @InjectRepository(ProfileImage) repository: Repository<ProfileImage>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    super(repository, ProfileImage);
  }

  async findByUserId(userId: string): Promise<ProfileImage | null> {
    return this.repository.findOne({
      where: { user: { id: userId } },
    });
  }

  async upsertUserPorfileImg(
    userId: string,
    fileMeta: Partial<ProfileImage>,
  ): Promise<ProfileImage> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    const user = await queryRunner.manager.findOneBy(User, { id: userId });

    if (!user) throw new UnauthorizedException(SYS_MSG.UNAUTHORIZED);

    await queryRunner.startTransaction();
    try {
      const existing = await queryRunner.manager
        .createQueryBuilder(ProfileImage, 'img')
        .setLock('pessimistic_write')
        .where('img.user.id = :userId', { userId })
        .getOne();

      await queryRunner.manager
        .createQueryBuilder(ProfileImage, 'img')
        .insert()
        .into(ProfileImage)
        .values({
          ...fileMeta,
          user: { id: userId },
        })
        .orUpdate(
          [
            'file_extname',
            'filename',
            'filesize_bytes',
            'mime_type',
            'cloudinary_public_id',
            'cloudinary_url',
            'thumbnail_url',
            'format',
            'resource_type',
            'version',
            'metadata',
          ],
          ['user_id'],
        )
        .returning('cloudinary_public_id')
        .execute();

      const saved = await queryRunner.manager.findOne(ProfileImage, {
        where: { user: { id: userId } },
      });

      if (!saved)
        throw new InternalServerErrorException(SYS_MSG.ERROR_UPLOADING_FILE);

      const oldCloudinaryPublicIdToDelete =
        existing?.cloudinaryPublicId &&
        existing.cloudinaryPublicId !== fileMeta.cloudinaryPublicId
          ? existing.cloudinaryPublicId
          : undefined;

      await queryRunner.commitTransaction();

      if (oldCloudinaryPublicIdToDelete) {
        await this.cloudinaryService.deleteByPublicId(
          oldCloudinaryPublicIdToDelete,
        );
      }

      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        'Error uploading img',
        err instanceof Error ? err.stack : JSON.stringify(err),
      );
      throw new ServiceUnavailableException(SYS_MSG.ERROR_UPLOADING_FILE);
    } finally {
      await queryRunner.release();
    }
  }
}
