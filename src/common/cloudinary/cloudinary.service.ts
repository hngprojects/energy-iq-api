import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from 'cloudinary';
import { cloudinaryConfig } from '../../config/cloudinary.config';
import { CloudinaryFileEntity } from '../../database/entities/cloudinary-file.entity';

@Injectable()
export class CloudinaryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CloudinaryService.name);
  constructor(
    @Inject(cloudinaryConfig.KEY)
    private readonly cfg: ConfigType<typeof cloudinaryConfig>,
  ) {}
  onApplicationBootstrap() {
    cloudinary.config({
      cloud_name: this.cfg.cloudName,
      api_key: this.cfg.apiKey,
      api_secret: this.cfg.apiSecret,
      secure: true,
    });
  }

  generateThumbnailUrl(res: UploadApiResponse): string {
    const cloudName = this.cfg.cloudName;
    const resourceUrl = this.cfg.resourceURL;
    const format = res.format;
    return `${resourceUrl}/${cloudName}/image/upload/c_thumb,w_200,h_200/${res.public_id}.${format}`;
  }

  generateAdditionalProperties(
    res: UploadApiResponse,
  ): Partial<CloudinaryFileEntity> {
    console.log(res);
    const props: Partial<CloudinaryFileEntity> = {
      thumbnailUrl: this.generateThumbnailUrl(res),
      cloudinaryPublicId: res.public_id,
      format: res.format,
      cloudinaryUrl: res.secure_url,
      resourceType: res.resource_type,
      ...(res.version && { version: res.version }),
      metadata: {
        uploadedAt: res.created_at,
        etag: res.etag,
        versionId: res['version_id'],
        assetFolder: res['asset_folder'],
      },
    };

    return props;
  }

  async signedUploadFileFromMetadata(
    folder: string,
    data: CloudinaryFileEntity,
    buffer: Buffer,
  ): Promise<CloudinaryFileEntity | null> {
    const options: UploadApiOptions = {
      folder,
      // public_id: data.filename!.replace(/\.[^/.]+$/, ''),
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      resource_type: 'auto',
    };

    try {
      const mimeType = data.mimeType ?? 'application/octet-stream';
      const result = await cloudinary.uploader.upload(
        `data:${mimeType};base64,${buffer.toString('base64')}`,
        options,
      );

      const additionalProperties = this.generateAdditionalProperties(result);

      const fileEntity: CloudinaryFileEntity = {
        ...data,
        ...additionalProperties,
      };

      return fileEntity;
    } catch (err) {
      const errorMessage = 'An error occured uploading file';
      const errorStack =
        err instanceof Error ? err.stack : JSON.stringify(err, null, 2);

      this.logger.error(errorMessage, errorStack);
      return null;
    }
  }

  // in CloudinaryService
  async deleteByPublicId(publicId: string): Promise<boolean> {
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (err) {
      this.logger.error(`Error deleting ${publicId}`, err);
      return false;
    }
  }
}
