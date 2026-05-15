import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { Chat } from './chat.entity';
import { MessageDeliveryStatus } from '../helpers/delivery-status';
import { MessageContentType } from '../helpers/content-type';

@Entity('messages')
export class Message extends AbstractBaseEntity {
  @ManyToOne(() => Chat, (chat) => chat.messages, {
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  chat: Chat;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'varchar', length: 40 })
  contentType: MessageContentType;

  @Column({ type: 'varchar', length: 40 })
  deliveryStatus: MessageDeliveryStatus;

  @Column({ type: 'boolean', default: false })
  isTransitioning: boolean;

  @Column({ type: 'varchar', length: '50' })
  senderId: string; // for messages sent by the system, this value will be `SYSTEM_SENDER_ID` and for messages sent by the user, its value will be the user's id
}
