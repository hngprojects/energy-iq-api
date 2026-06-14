import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable } from '@nestjs/common';
import { UploadedImage } from '../entities/uploaded-img.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UploadedImgModelAction extends AbstractModelAction<UploadedImage> {
  constructor(
    @InjectRepository(UploadedImage) repository: Repository<UploadedImage>,
  ) {
    super(repository, UploadedImage);
  }

  async findByUserId(userId: string): Promise<UploadedImage | null> {
    return this.repository.findOne({
      where: { user: { id: userId } },
    });
  }
}
