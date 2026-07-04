import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { InverterMemberModelAction } from '../../modules/team-access/action/inverter-member.action';
import {
  InverterMemberStatus,
  InverterRole,
} from '../enums/inverter-role.enum';
import { SYS_MSG } from '../constants/sys-msg';
import { Reflector } from '@nestjs/core';
import { INVERTER_ROLES_KEY } from '../decorators/inverter-roles.decorator';
import { InvertersService } from '../../modules/inverters/inverters.service';

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

    const inverterId = request.params['inverterId'].toString();
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

    return requiredRoles.some((role) => inverterMember.role === role);
  }
}
