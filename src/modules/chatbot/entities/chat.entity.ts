import { Column, Entity, OneToMany } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { Message } from './message.entity';
import { Exclude } from 'class-transformer';

@Entity('chats')
export class Chat extends AbstractBaseEntity {
  @Column({ type: 'int', nullable: true })
  contextLength: number;

  @Column({ type: 'int', nullable: true })
  expirationTimeoutSeconds: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageTimestamp: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  lastMessagePreview: string;

  @Exclude()
  @OneToMany(() => Message, (message) => message.chat)
  messages: Message[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  roomId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  title: string | null;

  @Column({ type: 'uuid', nullable: false })
  userId: string;
}
