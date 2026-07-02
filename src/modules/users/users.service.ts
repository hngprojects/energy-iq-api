import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
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
import { UserSettingsModelAction } from './actions/user-settings.action';
import { UpdateUserPersonalSettingsDto } from './dto/update-user-personal-settings.dto';
import { UserSettings } from './entities/user-settings.entity';
import { GeneratorFuelType } from '../../common/enums/generator';
import { UploadProfileImgDto } from './dto/upload-profile-img.dto';
import fs from 'node:fs/promises';
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';
import path from 'node:path';
import { ProfileImageModelAction } from './actions/profile-img.action';
import { Session } from './entities/sessions.entity';
import { SessionModelAction } from './actions/sessions.action';
import { CreateSessionDto } from '../auth/dto/create-session.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly profileImageAction: ProfileImageModelAction,
    private readonly userModelAction: UserModelAction,
    private readonly userSettingsModelAction: UserSettingsModelAction,
    private readonly invertersService: InvertersService,
    private readonly sessionModelAction: SessionModelAction,
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

  async createSession(
    userId: string,
    dto?: CreateSessionDto,
  ): Promise<Session> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.sessionModelAction.create({
      ...noTransaction(),
      createPayload: {
        userId,
        ...(dto?.deviceName && { deviceName: dto.deviceName.slice(0, 100) }),
        ...(dto?.ipAddress && { ipAddress: dto.ipAddress.slice(0, 45) }),
        ...(dto?.platform && { platform: dto.platform.slice(0, 20) }),
        ...(dto?.userAgent && { userAgent: dto.userAgent }),
        expiresAt,
      },
    });
  }

  async findSessionById(sessionId: string): Promise<Session> {
    const session = await this.sessionModelAction.findById(sessionId);
    if (!session) throw new NotFoundException(SYS_MSG.INVALID_SESSION_ID);

    if (!session.isActive)
      throw new UnauthorizedException(SYS_MSG.SESSION_EXPIRED);
    if (session.expiresAt && Date.now() > session.expiresAt.getTime()) {
      await this.sessionModelAction.update({
        ...noTransaction(),
        identifierOptions: { id: sessionId },
        updatePayload: {
          isActive: false,
        },
      });
      throw new UnauthorizedException(SYS_MSG.SESSION_EXPIRED);
    }
    return session;
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

  async setRefreshTokenHash(
    sessionId: string,
    hash: string | null,
  ): Promise<void> {
    const updated = await this.sessionModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: sessionId },
      updatePayload: {
        refreshTokenHash: hash,
        lastActivityAt: new Date(),
        ...(hash === null && { isActive: false }),
        ...(hash !== null && {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
      },
    });
    if (!updated)
      throw new InternalServerErrorException(SYS_MSG.SESSION_UPDATE_FAILED);
  }

  /**
   * Atomically swaps the refresh token hash only if the current stored hash
   * matches expectedHash. Returns false if the swap lost the race (another
   * request already rotated the token), true on success.
   */
  async compareAndSwapRefreshToken(
    sessionId: string,
    expectedHash: string,
    newHash: string,
  ): Promise<boolean> {
    return this.sessionModelAction.compareAndSwapRefreshTokenHash(
      sessionId,
      expectedHash,
      newHash,
    );
  }

  async deactivateSession(id: string): Promise<void> {
    const updated = await this.sessionModelAction.update({
      ...noTransaction(),
      identifierOptions: { id },
      updatePayload: {
        isActive: false,
        refreshTokenHash: null,
        lastActivityAt: new Date(),
      },
    });
    if (!updated) throw new NotFoundException(SYS_MSG.INVALID_SESSION_ID);
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
  ): Promise<{ inverter: Inverter; created: boolean }> {
    const result = await this.invertersService.connectInverter(dto, userId);

    await this.userModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: userId },
      updatePayload: {
        onboardingStep: 3,
        onboardingComplete: true,
        inverterBrand: dto.brand,
      },
    });

    return result;
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

  async uploadProfileImage(dto: UploadProfileImgDto, userId: string) {
    const user = await this.findOne(userId);
    const fileMeta = {
      filename: dto.file.originalname.toLowerCase(),
      fileExtname: path.extname(dto.file.originalname).toLowerCase(),
      filesizeBytes: dto.file.size.toString(),
      mimeType: dto.file.mimetype,
    };

    let uploadRes: Awaited<
      ReturnType<CloudinaryService['signedUploadFileFromMetadata']>
    > = null;

    try {
      uploadRes = await this.cloudinaryService.signedUploadFileFromMetadata(
        'user_profile_images',
        fileMeta,
        dto.file.buffer,
      );

      if (!uploadRes)
        throw new ServiceUnavailableException(SYS_MSG.ERROR_UPLOADING_FILE);

      const fullImg = {
        ...uploadRes,
        user,
        userId,
      };

      const profileImage = await this.profileImageAction.upsertUserPorfileImg(
        userId,
        fullImg,
      );

      return profileImage;
    } catch (err) {
      if (uploadRes?.cloudinaryPublicId) {
        await this.cloudinaryService.deleteByPublicId(
          uploadRes.cloudinaryPublicId,
        );
      }
      this.logger.error(
        `Failed to upload user image: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof ServiceUnavailableException) throw err;
      throw new InternalServerErrorException(SYS_MSG.ERROR_UPLOADING_FILE);
    } finally {
      if (dto.file.path) {
        await this.deleteFile(dto.file.path);
      }
    }
  }

  /**
   * METHODS FOR UPDATING A USER'S SETTING
   */

  // Personal/business settings
  async updatePersonalSettings(
    userId: string,
    dto: UpdateUserPersonalSettingsDto,
  ): Promise<UserSettings> {
    // update user-level fields
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const userUpdatePayload: Partial<User> = {};
      if (dto.firstName !== undefined)
        userUpdatePayload.firstName = dto.firstName;
      if (dto.lastName !== undefined) userUpdatePayload.lastName = dto.lastName;

      const updatedUser = await this.userModelAction.update({
        ...noTransaction(),
        identifierOptions: { id: userId },
        updatePayload: userUpdatePayload,
      });

      if (!updatedUser) {
        throw new InternalServerErrorException(SYS_MSG.INTERNAL_SERVER_ERROR);
      }
    }

    // update settings-level fields
    let settings = await this.userSettingsModelAction.findByUserId(userId);

    const user = await this.findOne(userId);

    if (!settings) {
      // Auto-create settings if they dont exist yet
      settings = await this.userSettingsModelAction.create({
        ...noTransaction(),
        createPayload: {
          user,
          ...(dto.profileUrl !== undefined && {
            profileUrl: dto.profileUrl,
          }),
          ...(dto.businessName !== undefined && {
            businessName: dto.businessName,
          }),
          ...(dto.businessType !== undefined && {
            businessType: dto.businessType,
          }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.aiLanguage !== undefined && { AiLanguage: dto.aiLanguage }),
          ...(dto.customFuelPriceNaira !== undefined && {
            customFuelPriceNaira: dto.customFuelPriceNaira,
          }),
          ...(dto.generatorRatedPowerKw !== undefined && {
            generatorRatedPowerKw: dto.generatorRatedPowerKw,
          }),
          ...(dto.generatorFuelType !== undefined &&
            this.isValidGeneratorType(dto.generatorFuelType) && {
              generatorFuelType:
                dto.generatorFuelType.toUpperCase() as GeneratorFuelType,
            }),
          ...(dto.generatorAverageDailyRuntimeHours !== undefined && {
            generatorAverageDailyRuntimeHours:
              dto.generatorAverageDailyRuntimeHours,
          }),
        },
      });

      return settings;
    }

    const updatePayload: Partial<UserSettings> = {
      ...(dto.profileUrl !== undefined && { profileUrl: dto.profileUrl }),
      ...(dto.businessName !== undefined && { businessName: dto.businessName }),
      ...(dto.businessType !== undefined && { businessType: dto.businessType }),
      ...(dto.state !== undefined && { state: dto.state }),
      ...(dto.city !== undefined && { city: dto.city }),
      ...(dto.aiLanguage !== undefined && { AiLanguage: dto.aiLanguage }),
      ...(dto.customFuelPriceNaira !== undefined && {
        customFuelPriceNaira: dto.customFuelPriceNaira,
      }),
      ...(dto.generatorRatedPowerKw !== undefined && {
        generatorRatedPowerKw: dto.generatorRatedPowerKw,
      }),
      ...(dto.generatorFuelType !== undefined &&
        this.isValidGeneratorType(dto.generatorFuelType) && {
          generatorFuelType:
            dto.generatorFuelType.toUpperCase() as GeneratorFuelType,
        }),
      ...(dto.generatorAverageDailyRuntimeHours !== undefined && {
        generatorAverageDailyRuntimeHours:
          dto.generatorAverageDailyRuntimeHours,
      }),
    };

    if (Object.keys(updatePayload).length === 0) {
      return settings;
    }

    const updated = await this.userSettingsModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: settings.id },
      updatePayload,
    });

    if (!updated) {
      throw new InternalServerErrorException(SYS_MSG.INTERNAL_SERVER_ERROR);
    }

    return {
      ...updated,
      user: user,
    };
  }

  async getUserSetting<K extends keyof UserSettings>(
    userId: string,
    settingName: K,
  ): Promise<UserSettings[K] | null> {
    return await this.userSettingsModelAction.getSettingValue(
      userId,
      settingName,
    );
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    const settings = await this.userSettingsModelAction.findByUserId(userId);
    if (!settings) throw new NotFoundException(SYS_MSG.NOT_FOUND);
    return settings;
  }

  private isValidGeneratorType(t: unknown): t is GeneratorFuelType {
    return (
      typeof t === 'string' &&
      Object.values(GeneratorFuelType)
        .map((f) => f.toLowerCase())
        .includes(t.toLowerCase())
    );
  }

  async deleteFile(path: string) {
    return await fs.unlink(path);
  }
}
