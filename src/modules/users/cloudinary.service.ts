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
import { FileUploadStatus } from '../../common/enums';
import { UploadedImage } from './entities/uploaded-img.entity';
import { cloudinaryConfig } from '../../config/cloudinary.config';

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
    return `${resourceUrl}/${cloudName}/image/upload/c_thumb,w_200,h_200/${res.public_id}.jpg`;
  }

  generateAdditionalProperties(res: UploadApiResponse): Partial<UploadedImage> {
    const props: Partial<UploadedImage> = {
      uploadStatus: FileUploadStatus.COMPLETE,
      uploadUrl: res.secure_url,
      thumbnail: this.generateThumbnailUrl(res),
      publicId: res.public_id,
    };

    return props;
  }

  async signedUploadFileFromMetadata(
    data: UploadedImage,
    buffer: Buffer,
  ): Promise<UploadedImage | null> {
    const options: UploadApiOptions = {
      folder: 'user_images',
      public_id: data.filename!.replace(/\.[^/.]+$/, ''),
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      resource_type: 'auto',
    };

    try {
      const mimeType =
        data.fileExtname === '.jpg' || data.fileExtname === '.jpeg'
          ? 'image/jpeg'
          : data.fileExtname === '.png'
            ? 'image/png'
            : data.fileExtname === '.webp'
              ? 'image/webp'
              : 'application/octet-stream';
      const result = await cloudinary.uploader.upload(
        `data:${mimeType};base64,${buffer.toString('base64')}`,
        options,
      );

      const additionalProperties = this.generateAdditionalProperties(result);

      const uploadedImage: UploadedImage = {
        ...data,
        ...additionalProperties,
      };

      return uploadedImage;
    } catch (err) {
      const errorMessage = 'An error occured uploading image';
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
