import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { type ConfigType } from '@nestjs/config';
import { googleConfig } from '../../../config/google.config';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SYS_MSG } from '../../../common/constants/sys-msg';

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
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { emails, name } = profile;
    if (
      !emails ||
      emails.length === 0 ||
      !name ||
      !name.givenName ||
      !name.familyName
    ) {
      throw new UnauthorizedException(SYS_MSG.MISSING_GOOGLE_PROFILE_INFO);
    }
    if (!emails[0].verified) {
      throw new UnauthorizedException(SYS_MSG.UNVERIFIED_GOOGLE_ACCOUNT_EMAIL);
    }
    const authResponse = await this.authService.findOrCreateGoogleOAuthUser({
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      googleId: profile.id,
    });
    done(null, authResponse);
  }
}
