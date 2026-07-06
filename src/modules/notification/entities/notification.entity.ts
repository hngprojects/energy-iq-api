import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { ProcessingStatus } from '../../../common/constants/processing-status';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
export class Notification extends AbstractBaseEntity {
  @Column({ type: 'text' })
  channelRoomId: string;

  @Column({ type: 'text', nullable: true })
  iconUrl?: string | null;

  @Column({ type: 'json', nullable: true })
  metaData?: object | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  subtitle: string;

  @Column({ type: 'text', nullable: true })
  textContent?: string | null;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'varchar', length: 50, default: ProcessingStatus.pending })
  inAppDeliveryStatus: ProcessingStatus;

  @Column({ type: 'varchar', length: 50, default: ProcessingStatus.pending })
  pushDeliveryStatus: ProcessingStatus;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
