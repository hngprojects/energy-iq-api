import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { AlertResolutionStatus } from '../enums/resolution-status.enum';
import { AlertSeverity } from '../enums/severity.enum';

@Entity('alerts')
export class Alert extends AbstractBaseEntity {
  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  type: string;

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
}
