import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import {
  ReportPeriod,
  ReportStatus,
  ReportType,
} from '../../../common/enums/reports.type';
import { type ReportKeyMetrics } from '../types/reports.type';
import { User } from '../../users/entities/user.entity';
import { Inverter } from '../../inverters/entities/inverters.entity';

@Entity('reports')
export class Report extends AbstractBaseEntity {
  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'uuid', nullable: false })
  inverterId: string;

  type: ReportType;

  name: string;

  period: ReportPeriod;

  referenceDate: Date;

  dateRequested: Date;

  dateDelivered: Date | null;

  status: ReportStatus;

  @Column({ type: 'jsonb' })
  keyMetrics: ReportKeyMetrics;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Inverter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inverter_id' })
  inverter: Inverter;
}
