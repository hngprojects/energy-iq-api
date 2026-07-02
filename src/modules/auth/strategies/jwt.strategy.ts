import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../../../config/jwt.config';
import { RedisService } from '../../../common/redis/redis.service';
import { SYS_MSG } from '../../../common/constants/sys-msg';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
    private readonly redis: RedisService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtCfg.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.jti || !payload.sessionId) {
      throw new UnauthorizedException(SYS_MSG.INVALID_TOKEN);
    }

    const blacklisted = await this.redis.get(payload.jti, 'blacklist');
    if (blacklisted) throw new UnauthorizedException(SYS_MSG.INVALID_TOKEN);

    const session = await this.usersService.findSessionById(payload.sessionId);

    if (
      !session.isActive &&
      session.expiresAt &&
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(SYS_MSG.INVALID_TOKEN);
    }

    return {
      sub: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      jti: payload.jti,
    };
  }
}
