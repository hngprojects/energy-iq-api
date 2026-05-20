import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';

@Entity('waitlist')
export class Waitlist extends AbstractBaseEntity {
  @Column({ type: 'citext', unique: true })
  email: string;

  @Column({ type: 'boolean', default: false })
  emailSent: boolean;

  @Column({ type: 'boolean', default: true })
  isSubscribed: boolean;
}
