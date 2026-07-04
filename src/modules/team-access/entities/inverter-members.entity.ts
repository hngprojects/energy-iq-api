import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  InverterMemberStatus,
  InverterRole,
} from '../../../common/enums/inverter-role.enum';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { Inverter } from '../../inverters/entities/inverters.entity';
import { User } from '../../users/entities/user.entity';

@Entity('inverter_members')
@Index(['inverterId', 'userId'])
@Index(['InverterId'])
@Index(['inverterId', 'email'])
export class InverterMember extends AbstractBaseEntity {
  @Column({ type: 'uuid' })
  inverterId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'uuid', unique: true })
  inviteToken: string;

  @Column({ type: 'timestamptz', nullable: true })
  inviteTokenExpiresAt?: Date;

  @Column({ type: 'citext' })
  email: string;

  @Column({ type: 'enum', enum: InverterRole, default: InverterRole.VIEWER })
  role: InverterRole;

  @Column({
    type: 'enum',
    enum: InverterMemberStatus,
    default: InverterMemberStatus.INVITED,
  })
  status: InverterMemberStatus;

  @Column({ type: 'uuid' })
  invitedById: string;

  @ManyToOne(() => Inverter)
  @JoinColumn({ name: 'inverter_id' })
  inverter: Inverter;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
