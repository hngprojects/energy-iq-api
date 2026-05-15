import { Exclude } from 'class-transformer';
import { Column, Entity } from 'typeorm';
import { AbstractBaseEntity } from '../../../database/entities/abstract-base.entity';
import { UserRole } from '../../../common/enums';

@Entity('users')
export class User extends AbstractBaseEntity {
  @Column({ type: 'citext', unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  googleId?: string;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 30, nullable: true })
  inverterBrand?: string;

  @Column({ type: 'smallint', nullable: true })
  onboardingStep?: number;

  @Column({ type: 'boolean', default: false })
  onboardingComplete: boolean;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Exclude()
  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  refreshTokenHash: string | null;
}
