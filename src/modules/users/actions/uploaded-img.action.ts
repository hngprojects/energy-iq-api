import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { UploadedImage } from '../entities/uploaded-img.entity';
import { noTransaction } from '../../../common/constants/transaction-options';

@Injectable()
export class UploadedImgModelAction extends AbstractModelAction<UploadedImage> {
  async saveImg(img: Partial<UploadedImage>) {
    return this.create({
      createPayload: img,
      ...noTransaction(),
    });
  }
}
