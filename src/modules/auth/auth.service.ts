import {
  Injectable,
  UnauthorizedException,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { User } from '../users/entities/user.entity';
import { PublicUser } from '../users/types/public-user.type';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { type ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../config/jwt.config';
import { EmailService } from '../email/email.service';
import { appConfig } from '../../config/app.config';
import * as OtpUtil from '../../common/utils/otp.util';
import { RedisService } from '../../common/redis/redis.service';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { GoogleOAuthDto } from './dto/google-oauth.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PasswordUtil } from '../../common/utils/password.util';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { googleConfig } from '../../config/google.config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleMobileLoginDto } from './dto/google-mobile-login.dto';
import type { Response } from 'express';
import { ValidateRedirectUrl } from '../../common/utils/redirect.util';
import { Session } from '../users/entities/sessions.entity';
import * as crypto from 'crypto';
import { CreateSessionDto } from './dto/create-session.dto';
import { registerFromInviteDto } from './dto/register-from-invite.dto';
import { TeamAccessService } from '../team-access/team-access.service';
import { InverterRole } from '../../common/enums/inverter-role.enum';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface InverterAccess {
  inverterId: string;
  role: InverterRole;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
  sessionId: string;
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
    @Inject(googleConfig.KEY)
    private readonly googleCfg: ConfigType<typeof googleConfig>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly redis: RedisService,
    private readonly teamAccessService: TeamAccessService,
  ) {
    this.googleClient = new OAuth2Client(this.googleCfg.googleClientId);
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    await this.sendVerificationEmail(user);
    return this.toPublicUser(user);
  }

  async registerFromInvite(
    dto: registerFromInviteDto,
    res: Response,
    sessionDto: CreateSessionDto,
  ): Promise<Omit<AuthResponse, 'refreshToken'>> {
    // ValidateInvite
    const invite = await this.teamAccessService.findInviteByTokenAndEmail(
      dto.inviteToken,
      dto.email,
    );
    const user = await this.usersService.createTeamInvitedUser({
      email: invite.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: dto.password,
    });

    /**
     * A user getting the inviteToken from their email is equivalent
     * to the user checking an OTP and verifying their email, it serves
     * the same purpose. So we go straight to onboarding step 2
     * (sending welcome email).
     */
    await this.sendWelcomeEmail(user);
    // Send invite accept email
    await this.emailService.sendTeamInviteAcceptedEmail(
      user.email,
      user.firstName,
      '',
      invite.role,
    );
    await this.teamAccessService.activateMembership(invite);

    const session = await this.usersService.createSession(user.id, sessionDto);

    const { refreshToken, ...tokens } = await this.issueTokens(user, session);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    return tokens;
  }

  async existingUserAcceptInvite(
    inviteToken: string,
    userId: string,
  ): Promise<InverterAccess> {
    const user = await this.usersService.findOne(userId);
    const invite = await this.teamAccessService.findInviteByTokenAndEmail(
      inviteToken,
      user.email,
    );

    await this.teamAccessService.activateMembership(invite);
    // Send invite accept email
    await this.emailService.sendTeamInviteAcceptedEmail(
      user.email,
      user.firstName,
      '',
      invite.role,
    );

    return {
      inverterId: invite.inverterId,
      role: invite.role,
    };
  }

  async findOrCreateGoogleOAuthUser(
    dto: GoogleOAuthDto,
  ): Promise<AuthResponse> {
    const user = await this.usersService.findOrCreateByGoogle(dto);
    const session = await this.usersService.createSession(user.id);
    return this.issueTokens(user, session);
  }

  async login(
    dto: LoginDto,
    sessionDto: CreateSessionDto,
    res: Response,
  ): Promise<Omit<AuthResponse, 'refreshToken'>> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException(SYS_MSG.INVALID_CREDENTIALS);

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException(SYS_MSG.INVALID_CREDENTIALS);

    if (!user.emailVerified) {
      await this.sendVerificationEmail(user);
      throw new ForbiddenException(SYS_MSG.EMAIL_NOT_VERIFIED);
    }

    const session = await this.usersService.createSession(user.id, sessionDto);

    const { refreshToken, ...tokens } = await this.issueTokens(user, session);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.appCfg.nodeEnv !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    return tokens;
  }

  async googleMobileLogin(
    dto: GoogleMobileLoginDto,
    sessionDto: CreateSessionDto,
  ): Promise<AuthResponse> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: [this.googleCfg.googleClientId],
      });

      payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException(SYS_MSG.INVALID_GOOGLE_TOKEN);
      }
      if (!payload.email_verified) {
        throw new UnauthorizedException(
          SYS_MSG.UNVERIFIED_GOOGLE_ACCOUNT_EMAIL,
        );
      }
      if (payload.email.length === 0 || payload.email === '') {
        throw new UnauthorizedException(SYS_MSG.MISSING_GOOGLE_PROFILE_INFO);
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(SYS_MSG.GOOGLE_MOBILE_AUTH_FAILED);
    }

    const firstName =
      payload.given_name ?? payload.name?.split(' ')[0] ?? 'User';
    const lastName =
      payload.family_name ?? payload.email.split(' ').slice(1).join(' ') ?? '';
    const googleOAuthDto = {
      email: payload.email,
      firstName,
      lastName,
      googleId: payload.sub,
    };

    const user = await this.usersService.findOrCreateByGoogle(googleOAuthDto);

    const session = await this.usersService.createSession(user.id, sessionDto);
    return this.issueTokens(user, session);
  }

  googleCallbackRedirect(
    state: string,
    res: Response,
    authResponse: AuthResponse,
  ) {
    res.cookie('refresh_token', authResponse.refreshToken, {
      httpOnly: true,
      secure: this.appCfg.nodeEnv !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    if (state === 'mobile') {
      return res.json({
        accessToken: authResponse.accessToken,
        sessionId: authResponse.sessionId,
        user: authResponse.user,
      });
    }

    let redirectBase = this.appCfg.clientUrl;

    if (typeof state === 'string' && state.startsWith('web:')) {
      let requested: string;
      try {
        requested = decodeURIComponent(state.slice(4));
      } catch {
        throw new BadRequestException(SYS_MSG.INVALID_OAUTH_STATE);
      }
      // violently reject it if an unallowed redirect origin was passed
      ValidateRedirectUrl(requested, this.appCfg.allowedRedirectOrigins);
      redirectBase = requested;
    }

    const redirectUrl = `${redirectBase}/onboarding`;
    ValidateRedirectUrl(redirectUrl, this.appCfg.allowedRedirectOrigins);
    return res.redirect(
      `${redirectUrl}#token=${authResponse.accessToken}&sessionId=${authResponse.sessionId}`,
    );
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    sessionDto: CreateSessionDto,
    res: Response,
  ): Promise<Omit<AuthResponse, 'refreshToken'> | PublicUser> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException(SYS_MSG.INVALID_OTP);

    if (user.emailVerified) return this.toPublicUser(user);

    const attemptKey = `${dto.email}`;
    const attemptsRaw = await this.redis.get(attemptKey, 'otp_attempts');
    const attempts = attemptsRaw ? Number.parseInt(attemptsRaw, 10) : 0;
    if (attempts >= 5)
      throw new UnauthorizedException(SYS_MSG.OTP_ATTEMPTS_EXCEEDED);

    const storedHash = await this.redis.get(dto.email, 'otp');
    const match = storedHash
      ? await bcrypt.compare(dto.otp, storedHash)
      : false;

    if (!match) {
      await this.redis.set(attemptKey, `${attempts + 1}`, 'otp_attempts', 900);
      throw new UnauthorizedException(SYS_MSG.INVALID_OTP);
    }

    await this.usersService.setEmailVerified(user.id, true);
    await this.redis.delete(dto.email, 'otp');
    await this.redis.delete(attemptKey, 'otp_attempts');

    const session = await this.usersService.createSession(user.id, sessionDto);

    user.emailVerified = true;
    const { refreshToken, ...tokens } = await this.issueTokens(user, session);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.appCfg.nodeEnv !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    await this.sendWelcomeEmail(user);

    return tokens;
  }

  async resendVerificationEmail(dto: ResendVerificationDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new NotFoundException(SYS_MSG.USER_NOT_FOUND);

    const attemptKey = `${dto.email}`;
    const attemptsRaw = await this.redis.get(attemptKey, 'otp_resend_attempts');
    const attempts = attemptsRaw ? Number.parseInt(attemptsRaw, 10) : 0;
    if (attempts >= 5)
      throw new UnauthorizedException(SYS_MSG.OTP_ATTEMPTS_EXCEEDED);

    await this.redis.set(
      attemptKey,
      `${attempts + 1}`,
      'otp_resend_attempts',
      900,
    );
    await this.sendVerificationEmail(user);
    return this.toPublicUser(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    /**
     * Steps to execute forgotPassword
     *
     * 1. check that a user exists with the email
     * 2. If user does not exist, return 200 without sending mail
     * 3. If user exists, ensure that the user is email verified
     * 4. send password reset email
     * 5. cache a password reset record
     *
     * Notes: Users that signed up with google should be able to attach passwords to their accounts (confirm that having a password will not break google auth)
     */
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      if (!user.emailVerified) return dto;

      const token = await this.sendPasswordResetEmail(user);

      const passwordResetKey = dto.email;
      const uniqueKey = 'password_reset_token';
      const tokenHash = await bcrypt.hash(token, 10);
      await this.redis.set(passwordResetKey, tokenHash, uniqueKey, 300);
    }
    return dto;
  }

  async sendPasswordResetEmail(user: User): Promise<string> {
    let clientUrl = this.appCfg.clientUrl;
    if (clientUrl.endsWith('/')) {
      clientUrl = clientUrl.substring(0, clientUrl.length - 1);
    }
    const token = PasswordUtil.generateResetToken();
    const resetLink = `${clientUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordReset(
      user.email,
      resetLink,
      user.firstName,
    );
    return token;
  }

  async resetPassword(dto: ResetPasswordDto) {
    /**
     * Steps to execute resetPassword
     *
     * 1. ensure that a password reset record exists with this email
     * 2. ensure that a user exists with this email
     * 3. ensure that the user's email is verified
     * 4. update the user's password hash
     * 5. return a success response
     */
    const passwordResetKey = `${dto.email}`;
    const tokenHash = await this.redis.get(
      passwordResetKey,
      'password_reset_token',
    );
    if (!tokenHash) throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    const matches = await bcrypt.compare(dto.token, tokenHash);
    if (!matches) throw new UnauthorizedException(SYS_MSG.INVALID_TOKEN);

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new ForbiddenException(SYS_MSG.INVALID_CREDENTIALS);

    if (!user.emailVerified)
      throw new ForbiddenException(SYS_MSG.UNVERIFIED_USER);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.usersService.updatePasswordHash(user.id, passwordHash);

    await this.emailService.sendPasswordUpdate(
      user.email,
      this.appCfg.clientUrl,
      user.firstName,
    );

    await this.redis.delete(`${dto.email}`, 'password_reset_token');

    return this.toPublicUser(user);
  }

  async refresh(
    refreshToken: string,
    sessionId: string,
    res: Response,
  ): Promise<Omit<AuthTokens, 'refreshToken'>> {
    const session = await this.usersService.findSessionById(sessionId);

    const user = await this.usersService.findOne(session.userId);

    if (!session.refreshTokenHash)
      throw new UnauthorizedException(SYS_MSG.INVALID_REFRESH_TOKEN);

    const matches = this.compareRefreshTokenHash(
      refreshToken,
      session.refreshTokenHash,
    );
    if (!matches)
      throw new UnauthorizedException(SYS_MSG.INVALID_REFRESH_TOKEN);

    const { refreshToken: newRefreshToken, ...tokens } = await this.signTokens(
      user,
      session,
    );
    const newHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    // Atomic compare-and-swap: only succeeds if no concurrent request has
    // already rotated the token since we read it above.
    const swapped = await this.usersService.compareAndSwapRefreshToken(
      session.id,
      session.refreshTokenHash,
      newHash,
      session.createdAt,
    );
    if (!swapped)
      throw new UnauthorizedException(SYS_MSG.INVALID_REFRESH_TOKEN);

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: this.appCfg.nodeEnv !== 'development',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });
    return tokens;
  }

  compareRefreshTokenHash(received: string, storedHash: string): boolean {
    const receivedHash = crypto
      .createHash('sha256')
      .update(received)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  }

  async logout(sessionId: string, accessToken: string): Promise<void> {
    try {
      const decoded: JwtPayload & { exp: number } =
        this.jwtService.decode(accessToken);

      if (decoded.jti && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redis.set(decoded.jti, '1', 'blacklist', ttl);
        }
      }
    } finally {
      await this.usersService.deactivateSession(sessionId);
    }
  }

  async getProfile(userId: string): Promise<User> {
    return this.usersService.findOne(userId);
  }

  private async issueTokens(
    user: User,
    session: Session,
  ): Promise<AuthResponse> {
    const tokens = await this.signTokens(user, session);
    await this.persistRefreshToken(session.id, tokens.refreshToken);

    return { ...tokens, user: this.toPublicUser(user), sessionId: session.id };
  }

  private async signTokens(user: User, session: Session): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      jti: crypto.randomUUID(),
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.jwtCfg.accessSecret,
      expiresIn: this.jwtCfg.accessExpiresIn as StringValue,
    });
    const refreshToken = crypto.randomBytes(32).toString('hex');
    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.usersService.setRefreshTokenHash(sessionId, hash);
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      lastLoginAt: user.lastLoginAt ?? undefined,
      emailVerified: user.emailVerified ?? false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const otp = OtpUtil.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    await this.redis.set(user.email, otpHash, 'otp', 900);

    return this.emailService.sendVerifyEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      otp,
      this.appCfg.clientUrl,
    );
  }

  private async sendWelcomeEmail(user: User): Promise<void> {
    return this.emailService.sendWelcome(
      user.email,
      `${user.firstName} ${user.lastName}`,
      this.appCfg.clientUrl,
    );
  }
}
