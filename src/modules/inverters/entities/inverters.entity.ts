import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { InverterBrand, InverterApiType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { InvertersMetrics } from '../../inverters-metrics/entities/inverters-metrics.entity';

@Entity('inverters')
@Index(['userId', 'isActive'])
@Index(['brand', 'serialNumber'])
export class Inverter extends AbstractBaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: InverterBrand })
  brand: InverterBrand;

  @Column({ type: 'varchar', length: 255 })
  model: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  serialNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  installationId?: string;

  @Column({ type: 'enum', enum: InverterApiType })
  apiType: InverterApiType;

  @Column({ type: 'text', nullable: true })
  encryptedCredentials?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt?: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  ratedCapacityKwh: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  panelCapacityKw: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => InvertersMetrics, (metric) => metric.inverter, {
    cascade: true,
  })
  metrics: InvertersMetrics[];
}
