import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { FileUploadStatus } from '../../../common/enums';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { User } from './user.entity';

@Entity('uploaded-images')
export class UploadedImage extends AbstractBaseEntity {
  @Column({ type: 'varchar', length: 10 })
  fileExtname: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename?: string;

  @Column({ type: 'bigint' })
  filesizeBytes: number;

  @Column({ type: 'varchar', length: 255 })
  publicId: string;

  @Column({
    type: 'enum',
    enum: FileUploadStatus,
    default: FileUploadStatus.PENDING,
  })
  uploadStatus: FileUploadStatus;

  @Column({ type: 'text' })
  uploadUrl?: string;

  @Column({ type: 'varchar', length: 255 })
  uploadedByEmail: string;

  @Column({ type: 'text' })
  thumbnail?: string;

  @OneToOne(() => User, (user) => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
