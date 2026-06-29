import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CloudinaryFileEntity } from '../../../database/entities/cloudinary-file.entity';
import { Report } from './report.entity';
import { User } from '../../users/entities/user.entity';

@Entity('uploaded-reports')
export class UploadedReport extends CloudinaryFileEntity {
  @Column({ type: 'uuid', unique: true })
  reportId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
  shareToken: string;

  @Column({ type: 'timestamptz', nullable: true })
  shareableLinkExpiresAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  deleteJobId?: string;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @ManyToOne(() => Report)
  @JoinColumn({ name: 'report_id' })
  report: Report;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
