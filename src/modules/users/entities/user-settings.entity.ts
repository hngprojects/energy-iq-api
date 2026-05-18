import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { User } from './user.entity';

@Entity('user_settings')
export class UserSettings extends AbstractBaseEntity {
  @Column({ type: 'boolean' })
  smsNotification: boolean;

  @Column({ type: 'boolean' })
  whatsappAlerts: boolean;

  @Column({ type: 'boolean' })
  criticalAlerts: boolean;

  @Column({ type: 'boolean' })
  AiLanguage: boolean;

  @OneToOne(() => User, (user) => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}