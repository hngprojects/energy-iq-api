import { AbstractModelAction } from '@hng-sdk/orm';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UserModelAction extends AbstractModelAction<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository, User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.get({ identifierOptions: { email } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.get({ identifierOptions: { googleId } });
  }

  async upsertByGoogle(data: {
    email: string;
    firstName: string;
    lastName: string;
    googleId: string;
  }): Promise<User> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        googleId: data.googleId,
        emailVerified: true,
        onboardingStep: 2,
        onboardingComplete: false,
      })
      .orUpdate(['google_id', 'email_verified'], ['email'])
      .returning(['id'])
      .execute();

    const raw = result.raw as User[];
    const id: string = (result.identifiers[0]?.id as string) ?? raw[0]?.id;
    const user = await this.get({ identifierOptions: { id } });
    if (!user) {
      throw new InternalServerErrorException('Failed to load upserted user');
    }
    return user;
  }
}
