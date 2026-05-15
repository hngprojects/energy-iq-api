import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';

@Entity('alerts')
export class Alert extends AbstractBaseEntity {
  // @ManyToOne(() => User, (user) => user.alerts)
  // @JoinColumn({ name: 'user_id' })
  // user: string;
  @Column({ type: 'uuid' })
  userId: string;

  @Column()
  type: string;

  @Column({ type: 'varchar', length: 50 })
  platform: string;

  @Column()
  severity: string;

  @Column('text')
  message: string;

  @Column({ default: false })
  resolved: boolean;
}
