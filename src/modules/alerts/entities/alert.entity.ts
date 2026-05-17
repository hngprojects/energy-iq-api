import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import {
  AlertResolutionStatus,
  AlertSeverity,
  AlertType,
} from '../../../common/enums';
import { ProcessingStatus } from '../../../common/constants/processing-status';

@Entity('alerts')
export class Alert extends AbstractBaseEntity {
  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  type: AlertType;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Column({ type: 'varchar', length: 50 })
  severity: AlertSeverity;

  @Column({ type: 'varchar', length: 1024 })
  message: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resolutionStatus: AlertResolutionStatus | null;

  @Column({ type: 'timestamptz', nullable: false })
  triggeredAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 255, default: ProcessingStatus.pending })
  deliveryProcesingStatus: ProcessingStatus;
}
