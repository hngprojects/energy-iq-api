import { Column, Entity, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { Inverter } from '../../inverters/entities/inverters.entity';

@Entity('daily_metrics')
@Unique(['inverterId', 'date'])
@Index(['inverterId', 'date'])
export class DailyMetrics extends AbstractBaseEntity {
  @Column({ type: 'uuid' })
  inverterId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSolarEnergyWh: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAcOutputEnergyWh: number;

  @ManyToOne(() => Inverter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inverter_id' })
  inverter: Inverter;
}
