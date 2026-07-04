import { User } from '../entities/user.entity';

export type UserResponse = Omit<
  User,
  'passwordHash' | 'refreshTokenHash' | 'deletedAt' | 'googleId'
>;

export type PublicUser = Pick<
  UserResponse,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'createdAt'
  | 'updatedAt'
  | 'onboardingStep'
  | 'onboardingComplete'
  | 'isInvitedUser'
> & {
  lastLoginAt: Date | undefined;
  emailVerified: boolean;
};
