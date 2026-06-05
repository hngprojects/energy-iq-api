import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { User } from './user.entity';
import { GeneratorFuelType } from '../../../common/enums/generator';

@Entity('user_settings')
export class UserSettings extends AbstractBaseEntity {
  // Personal Business settings
  @Column({ type: 'varchar', nullable: true })
  profileUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  businessName?: string;

  @Column({ type: 'varchar', nullable: true })
  businessType?: string;

  @Column({ type: 'varchar', nullable: true })
  state?: string;

  @Column({ type: 'varchar', nullable: true })
  city?: string;

  // Notification settings
  @Column({ type: 'boolean', default: false, nullable: true })
  smsNotification?: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  whatsappAlerts?: boolean;

  // Should be true by default if WhatsApp is false by default
  @Column({ type: 'boolean', default: true, nullable: true })
  emailAlerts?: boolean;

  @Column({ type: 'boolean', default: false, nullable: true })
  criticalAlerts?: boolean;

  @Column({ type: 'varchar', nullable: true })
  AiLanguage?: string;

  @Column({ type: 'boolean', default: true, nullable: true })
  chatCardsEnabled?: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  quietHoursStart?: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  quietHoursEnd?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  timezone?: string;

  @Column({ type: 'int', default: 15, nullable: true })
  alertCooldownMinutes?: number;

  @Column({ type: 'int', default: 10, nullable: true })
  depletionThreshold?: number;

  @Column({ type: 'jsonb', nullable: true })
  channelQuietHours?: Record<string, { start: string; end: string }>;

  // Costs and Savings Settings
  @Column({
    type: 'enum',
    enum: GeneratorFuelType,
    default: GeneratorFuelType.PMS,
  })
  generatorFuelType: GeneratorFuelType;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  generatorRatedPowerKw: number;

  @OneToOne(() => User, (user) => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
