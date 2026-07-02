import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService, type AuthResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Throttle } from '@nestjs/throttler';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { appConfig } from '../../config/app.config';
import { type ConfigType } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleMobileLoginDto } from './dto/google-mobile-login.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const sessionDto = this.buildSessionDto(req);
    return this.authService.login(dto, sessionDto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a user email address' })
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const sessionDto = this.buildSessionDto(req);
    return this.authService.verifyEmail(dto, sessionDto);
  }

  @Public()
  @Get('google')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth redirect' })
  googleAuth() {
    // GoogleAuthGuard internally handles redirect to Google
  }

  @Public()
  @Get('google/callback')
  @HttpCode(HttpStatus.FOUND)
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Handles the OAuth callback from Google. On success, redirects the browser to ' +
      '`{CLIENT_URL}/onboarding#token=<accessToken>`. ' +
      'The access token is passed as a URL fragment (after `#`), not a query parameter. ',
  })
  googleCallback(
    @CurrentUser() authResponse: AuthResponse,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return this.authService.googleCallbackRedirect(state, res, authResponse);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('google/mobile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate a mobile user via Google ID Token',
    description:
      'Verifies the Google ID token provided by the mobile application and returns ' +
      'local application tokens.',
  })
  async googleMobile(@Body() dto: GoogleMobileLoginDto, @Req() req: Request) {
    const sessionDto = this.buildSessionDto(req);
    return this.authService.googleMobileLogin(dto, sessionDto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a new access token from a refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken, dto.sessionId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  @ApiBearerAuth()
  logout(
    @CurrentUser('sessionId') sessionId: string,
    @Headers('authorization') authHeader: string,
  ) {
    const accessToken = authHeader.replace('Bearer ', '');
    return this.authService.logout(sessionId, accessToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated user' })
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.sub);
  }

  @Public()
  @Post('resend-email-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend a verification email if no active code exists',
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set password after requesting reset' })
  resetPasword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  private buildSessionDto(req: Request): CreateSessionDto {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      platform: req.headers['sec-ch-ua-platform']?.toString(),
      deviceName: req.headers['sec-ch-ua-model']?.toString(),
    };
  }
}
