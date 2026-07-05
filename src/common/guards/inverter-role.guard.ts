import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { InverterMemberModelAction } from '../../modules/team-access/action/inverter-member.action';
import {
  INVERTER_ROLE_RANK,
  InverterMemberStatus,
  InverterRole,
} from '../enums/inverter-role.enum';
import { SYS_MSG } from '../constants/sys-msg';
import { Reflector } from '@nestjs/core';
import { INVERTER_ROLES_KEY } from '../decorators/inverter-roles.decorator';
import { InvertersService } from '../../modules/inverters/inverters.service';
import { IS_INVERTER_OUTSIDER_KEY } from '../decorators/inverter-outsider.decorator';

@Injectable()
export class InverterRoleGuard implements CanActivate {
  constructor(
    private readonly inverterMemberModelAction: InverterMemberModelAction,
    private reflector: Reflector,
    private readonly invertersService: InvertersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const isInverterOutsider = this.reflector.getAllAndOverride<boolean>(
      IS_INVERTER_OUTSIDER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isInverterOutsider) return true;

    const inverterId = request.params['inverterId'].toString();
    console.log('InvertedId: ', inverterId);
    if (!inverterId) return false;
    const user = request.user;
    if (!user) return false;

    const inverter = await this.invertersService.findOne(inverterId);
    if (user.sub === inverter.userId) return true;

    const inverterMember = await this.inverterMemberModelAction.get({
      identifierOptions: {
        inverterId,
        userId: user.sub,
        status: InverterMemberStatus.ACTIVE,
      },
    });

    if (!inverterMember) throw new ForbiddenException(SYS_MSG.FORBIDDEN);

    const requiredRoles = this.reflector.getAllAndOverride<InverterRole[]>(
      INVERTER_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const memberRank = INVERTER_ROLE_RANK[inverterMember.role];
    return requiredRoles.some((role) => memberRank >= INVERTER_ROLE_RANK[role]);
  }
}
