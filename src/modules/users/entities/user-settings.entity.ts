import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { User } from './user.entity';

@Entity('user_settings')
export class UserSettings extends AbstractBaseEntity {
  @Column({ type: 'boolean', default: false })
  smsNotification: boolean;

  @Column({ type: 'boolean', default: false })
  whatsappAlerts: boolean;

  @Column({ type: 'boolean', default: false })
  emailAlerts: boolean;

  @Column({ type: 'boolean' })
  criticalAlerts: boolean;

  @Column({ type: 'varchar' })
  AiLanguage: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  quietHoursStart: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  quietHoursEnd: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  timezone: string | null;

  @Column({ type: 'int', default: 15 })
  alertCooldownMinutes: number;

  @Column({ type: 'int', default: 10 })
  depletionThreshold: number;

  @Column({ type: 'jsonb', nullable: true })
  channelQuietHours: Record<string, { start: string; end: string }> | null;

  @OneToOne(() => User, (user) => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}