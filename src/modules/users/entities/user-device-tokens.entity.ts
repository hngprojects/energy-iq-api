import { Column, JoinColumn, ManyToOne } from 'typeorm';
import { Platform } from '../../../common/enums/platform.enum';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { User } from './user.entity';

export class UserDeviceTokens extends AbstractBaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  token: string;

  platform: Platform;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
