import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { v2 as cloudinary, UploadApiOptions } from 'cloudinary';
import { FileUploadStatus } from '../../common/enums';
import { CloudinaryUploadResDto } from './dto/cloudinary-res.dto';
import { UploadedImage } from './entities/uploaded-img.entity';
import { cloudinaryConfig } from '../../config/cloudinary.config';

@Injectable()
export class CloudinaryService implements OnApplicationBootstrap {
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

  generateThumbnailUrl(res: CloudinaryUploadResDto): string {
    const cloudName = this.cfg.cloudName;
    const resourceUrl = this.cfg.resourceURL;
    return `${resourceUrl}/${cloudName}/image/upload/c_thumb,w_200,h_200/${res.public_id}.jpg`;
  }

  generateAdditionalProperties(
    res: CloudinaryUploadResDto,
  ): Partial<UploadedImage> {
    const props: Partial<UploadedImage> = {
      upload_status: FileUploadStatus.COMPLETE,
      upload_url: res.url,
      thumbnail: this.generateThumbnailUrl(res),
    };
    if (res.format.toLowerCase() === 'pdf') {
      props.page_count = String(res.pages ?? 0);
    }
    return props;
  }

  async signedUploadFileFromMetadata(
    data: UploadedImage,
  ): Promise<UploadedImage> {
    const options: UploadApiOptions = {
      folder: 'user_images',
      public_id: data.filename!.replace(/\.[^/.]+$/, ''),
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      resource_type: 'auto',
    };

    const result = (await cloudinary.uploader.upload(
      data.filepath!,
      options,
    )) as unknown as CloudinaryUploadResDto;

    return {
      ...data,
      filename: undefined,
      filepath: undefined,
      ...this.generateAdditionalProperties(result),
    };
  }
}
