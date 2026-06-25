import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
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
@Unique(['seriesId', 'occurrence'])
export class Report extends AbstractBaseEntity {
  @Column({ type: 'uuid', nullable: false, name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', nullable: false, name: 'inverter_id' })
  inverterId: string;

  @Column({ type: 'enum', enum: ReportType, default: ReportType.GENERAL })
  type: ReportType;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'enum', enum: ReportPeriod, default: ReportPeriod.WEEKLY })
  period: ReportPeriod;

  @Column({ type: 'timestamptz', nullable: true })
  referenceDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dateDelivered?: Date;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'uuid', nullable: true })
  seriesId?: string;

  @Column({ type: 'smallint', nullable: true })
  occurrence?: number;

  @Column({ type: 'boolean', default: false })
  recurring: boolean;

  @Column({ type: 'jsonb', nullable: true })
  keyMetrics?: ReportKeyMetrics;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Inverter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inverter_id' })
  inverter: Inverter;
}
