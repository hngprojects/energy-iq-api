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
  deliveryProcessingStatus: ProcessingStatus;

  @Column({ type: 'boolean', default: true })
  deliverable?: boolean;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'partial_success';

  @Column({ type: 'varchar', length: 50, nullable: true })
  deliveryChannel?: string;

  @Column({ type: 'timestamptz', nullable: true })
  quietHoursDeferredUntil?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  cooldownExpiresAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
