import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { noTransaction } from '../../common/constants/transaction-options';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { UserModelAction } from './actions/users.action';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.do';
import { UpdateUserDto } from './dto/update-user.dto';
import { InvertersService } from '../inverters/inverters.service';
import { InverterConnectorDto } from '../inverters/dto/inverter-connector.dto';
import { Inverter } from '../inverters/entities/inverters.entity';
import { GoogleOAuthDto } from '../auth/dto/google-oauth.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly userModelAction: UserModelAction,
    private readonly invertersService: InvertersService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userModelAction.findByEmail(dto.email);
    if (existing) throw new ConflictException(SYS_MSG.CONFLICT);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.userModelAction.create({
      ...noTransaction(),
      createPayload: {
        email: dto.email,
        passwordHash: passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        onboardingStep: 1,
        onboardingComplete: false,
      },
    });
  }

  async findOrCreateByGoogle(dto: GoogleOAuthDto): Promise<User> {
    const existing = await this.userModelAction.findByGoogleId(dto.googleId);
    if (existing) return existing;

    const existingByEmail = await this.userModelAction.findByEmail(dto.email);

    if (
      existingByEmail?.googleId &&
      existingByEmail.googleId !== dto.googleId
    ) {
      throw new ConflictException(SYS_MSG.CONFLICTING_GOOGLE_ACCOUNT);
    }

    return this.userModelAction.upsertByGoogle({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      googleId: dto.googleId,
    });
  }

  findAll(pagination: PaginationDto) {
    return this.userModelAction.list({
      paginationPayload: { page: pagination.page!, limit: pagination.limit! },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModelAction.get({
      identifierOptions: { id },
    });
    if (!user) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userModelAction.findByEmail(email);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.findOne(id);

    const payload: Partial<User> = { ...dto };

    const updated = await this.userModelAction.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: payload,
    });
    if (!updated) {
      throw new InternalServerErrorException(SYS_MSG.INTERNAL_SERVER_ERROR);
    }
    return updated;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<User> {
    await this.findOne(id);

    const payload: Partial<User> = { passwordHash };

    const updated = await this.userModelAction.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: payload,
    });
    if (!updated) {
      throw new InternalServerErrorException(SYS_MSG.INTERNAL_SERVER_ERROR);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.userModelAction.delete({
      ...noTransaction(),
      identifierOptions: { id },
    });
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.userModelAction.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: { refreshTokenHash: hash },
    });
  }

  async setEmailVerified(id: string, emailVerified: boolean): Promise<void> {
    await this.userModelAction.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: {
        emailVerified,
        onboardingStep: emailVerified ? 2 : 1,
      },
    });
  }

  async connectUserInverter(
    dto: InverterConnectorDto,
    userId: string,
  ): Promise<Inverter> {
    const inverter = await this.invertersService.connectInverter(dto, userId);

    await this.userModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: userId },
      updatePayload: {
        onboardingStep: 3,
        onboardingComplete: true,
      },
    });

    return inverter;
  }

  async getOnboardingStatus(id: string) {
    const user = await this.findOne(id);

    return {
      currentStep: user.onboardingStep ?? 1,
      onboardingComplete: user.onboardingComplete,
      steps: {
        accountCreated: true,
        emailVerified: user.emailVerified,
        inverterConnected: user.onboardingComplete,
      },
    };
  }
}
