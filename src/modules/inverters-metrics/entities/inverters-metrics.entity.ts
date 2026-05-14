import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { Inverter } from '../../inverters/entities/inverters.entity';

@Entity('inverter_metrics')
@Index(['inverterId', 'createdAt'])
export class InvertersMetrics extends AbstractBaseEntity {
  @Column({ type: 'uuid' })
  inverterId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  solarGenKw: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  batterySocPercent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  loadKw: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  gridFrequencyHz?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  batteryVoltageV?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  batteryCurrentA?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  gridVoltageV?: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  nairaSavedNgn: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  dailyEnergyKwh?: number;

  @Column({ type: 'jsonb', nullable: true })
  rawData?: Record<string, unknown>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  inverterStatus?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  batteryTemperatureC?: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  batteryTimeToGoMin?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  inverterTemperatureC?: number;

  @Column({ type: 'timestamptz' })
  metricTimestamp: Date;

  @ManyToOne(() => Inverter, (inverter) => inverter.metrics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inverter_id' })
  inverter: Inverter;
}
