import { Column, Entity } from 'typeorm';
import { FileUploadStatus } from '../../../common/enums';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';

@Entity('uploaded-images')
export class UploadedImage extends AbstractBaseEntity {
  @Column({ type: 'varchar', length: 10 })
  file_extname: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename?: string;

  @Column({ type: 'text', nullable: true })
  filepath?: string;

  @Column({ type: 'bigint' })
  filesize_bytes: number;

  @Column({ type: 'varchar', length: 255 })
  page_count?: string;

  @Column({ type: 'varchar', length: 50 })
  upload_status: FileUploadStatus;

  @Column({ type: 'text' })
  upload_url?: string;

  @Column({ type: 'varchar', length: 255 })
  uploaded_by_email: string;

  @Column({ type: 'text' })
  thumbnail?: string;
}
