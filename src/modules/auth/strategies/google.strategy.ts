import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { type ConfigType } from '@nestjs/config';
import { googleConfig } from '../../../config/google.config';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SYS_MSG } from '../../../common/constants/sys-msg';
import { type Request } from 'express';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleConfig.KEY)
    googleCfg: ConfigType<typeof googleConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: googleCfg.googleClientId,
      clientSecret: googleCfg.googleClientSecret,
      callbackURL: googleCfg.googleCallbackUrl,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { emails, name } = profile;
    if (!emails || emails.length === 0) {
      throw new UnauthorizedException(SYS_MSG.MISSING_GOOGLE_PROFILE_INFO);
    }
    if (!emails[0].verified) {
      throw new UnauthorizedException(SYS_MSG.UNVERIFIED_GOOGLE_ACCOUNT_EMAIL);
    }
    const firstName =
      name?.givenName ?? profile.displayName.split(' ')[0] ?? 'User';
    const lastName =
      name?.familyName ??
      profile.displayName.split(' ').slice(1).join(' ') ??
      '';
    const authResponse = await this.authService.findOrCreateGoogleOAuthUser({
      email: emails[0].value,
      firstName,
      lastName,
      googleId: profile.id,
    });
    done(null, authResponse);
  }
}
