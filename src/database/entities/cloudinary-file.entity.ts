import { Column } from 'typeorm';
import { AbstractBaseEntity } from './abstract-base.entity';

export abstract class CloudinaryFileEntity extends AbstractBaseEntity {
  @Column({ type: 'varchar', length: 10 })
  fileExtname: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename?: string;

  @Column({ type: 'bigint' })
  filesizeBytes: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mimeType?: string;

  @Column({ type: 'varchar', length: 255 })
  cloudinaryPublicId: string;

  @Column({ type: 'text' })
  cloudinaryUrl: string;

  @Column({ type: 'text' })
  thumbnailUrl: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  format?: string;

  @Column({ type: 'varchar', length: 50, default: 'image' })
  resourceType: string;

  @Column({ type: 'int', nullable: true })
  version?: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
