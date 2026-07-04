import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { type ConfigType } from '@nestjs/config';
import { InverterMemberModelAction } from './action/inverter-member.action';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { noTransaction } from '../../common/constants/transaction-options';
import {
  InverterMemberStatus,
  InverterRole,
} from '../../common/enums/inverter-role.enum';
import { InverterMember } from './entities/inverter-members.entity';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { InvertersService } from '../inverters/inverters.service';
import { appConfig } from '../../config/app.config';
import { InviteMemberDto } from './dto/invite-member.dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class TeamAccessService {
  constructor(
    private readonly inverterMemberModelAction: InverterMemberModelAction,
    private readonly usersService: UsersService,
    private readonly invertersService: InvertersService,
    private readonly emailService: EmailService,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  /**
   * Invite a member to an inverter group.
   *
   * Path A — invited email has NO existing account:
   *   Creates a User with isInvitedUser=true, creates an InverterMember with
   *   status=INVITED, and emails them an invite link containing the token.
   *   They must register via POST /auth/register-from-invite to accept.
   *
   * Path B — invited email ALREADY has an account:
   *   Creates an InverterMember with status=ACTIVE and userId already set.
   *   Emails them a notification with a direct link to the inverter dashboard.
   *   No registration step needed.
   */
  async inviteMember(
    inverterId: string,
    invitedById: string,
    dto: InviteMemberDto,
  ): Promise<InverterMember> {
    // Prevent duplicate membership
    const existing =
      await this.inverterMemberModelAction.findByInverterIdAndEmail(
        inverterId,
        dto.email,
      );
    if (existing) throw new ConflictException(SYS_MSG.CONFLICT);

    const inverter = await this.invertersService.findOne(inverterId);
    const inviter = await this.usersService.findOne(invitedById);
    const inverterName = `${inverter.brand} ${inverter.model}`;
    const inviterName = `${inviter.firstName} ${inviter.lastName}`;

    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      // Path B: user already has an account — activate membership immediately
      const member = await this.inverterMemberModelAction.create({
        ...noTransaction(),
        createPayload: {
          inverterId,
          userId: existingUser.id,
          email: dto.email,
          role: dto.role,
          status: InverterMemberStatus.ACTIVE,
          invitedById,
          inviteToken: randomUUID(), // stored but not used for acceptance
        },
      });

      await this.emailService.sendTeamInviteExistingUser({
        to: dto.email,
        firstName: existingUser.firstName,
        inviterName,
        inverterName,
        role: dto.role,
        dashboardUrl: `${this.appCfg.clientUrl}/dashboard`,
      });

      return member;
    }

    // Path A: no account yet — create one and send an invite token
    const invitedUser = await this.usersService.createInvitedUser({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: randomUUID(),
    });

    const inviteToken = randomUUID();
    const inviteTokenExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const member = await this.inverterMemberModelAction.create({
      ...noTransaction(),
      createPayload: {
        inverterId,
        userId: invitedUser.id,
        email: dto.email,
        role: dto.role,
        status: InverterMemberStatus.INVITED,
        invitedById,
        inviteToken,
        inviteTokenExpiresAt,
      },
    });

    const acceptInviteUrl = `${this.appCfg.clientUrl}/accept-invite?token=${inviteToken}`;

    await this.emailService.sendTeamInviteNewUser({
      to: dto.email,
      inviterName,
      inverterName,
      role: dto.role,
      acceptInviteUrl,
      email: dto.email,
    });

    return member;
  }

  /**
   * Resolves an invite token.
   * Used by the auth service during the register-from-invite flow to
   * verify the token is valid and not expired before completing registration.
   */
  async getValidInviteByToken(token: string): Promise<InverterMember> {
    const member = await this.inverterMemberModelAction.get({
      identifierOptions: { inviteToken: token },
    });

    if (!member) throw new NotFoundException(SYS_MSG.INVITE_TOKEN_INVALID);

    if (member.status === InverterMemberStatus.ACTIVE) {
      throw new BadRequestException(SYS_MSG.INVITE_ALREADY_ACCEPTED);
    }

    if (
      member.inviteTokenExpiresAt &&
      member.inviteTokenExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(SYS_MSG.INVITE_TOKEN_EXPIRED);
    }

    return member;
  }

  /**
   * Activates a pending InverterMember after the invited user has
   * successfully verified their email (called from auth.service).
   */
  async activateMembership(memberId: string): Promise<void> {
    await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: memberId },
      updatePayload: {
        status: InverterMemberStatus.ACTIVE,
        // Expire the token so it cannot be reused
        inviteTokenExpiresAt: new Date(),
      },
    });
  }

  async activateMembershipByUserAndInverter(
    userId: string,
    inverterId: string,
  ): Promise<void> {
    await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: {
        userId,
        inverterId,
      },
      updatePayload: {
        status: InverterMemberStatus.ACTIVE,
        inviteTokenExpiresAt: new Date(),
      },
    });
  }

  async listMembers(inverterId: string): Promise<InverterMember[]> {
    const members = await this.inverterMemberModelAction.find({
      ...noTransaction(),
      findOptions: {
        inverterId,
      },
      paginationPayload: {
        page: 1,
        limit: 100,
      },
    });

    return members.payload;
  }

  async getMember(inverterId: string, userId: string): Promise<InverterMember> {
    const member = await this.inverterMemberModelAction.get({
      identifierOptions: { inverterId, userId },
    });
    if (!member)
      throw new NotFoundException(SYS_MSG.INVERTER_MEMBERSHIP_NOT_FOUND);
    return member;
  }

  async updateMemberRole(
    inverterId: string,
    userId: string,
    role: InverterRole,
  ): Promise<InverterMember> {
    const member = await this.getMember(inverterId, userId);
    const updated = await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: member.id },
      updatePayload: { role },
    });
    if (!updated)
      throw new NotFoundException(SYS_MSG.INVERTER_MEMBERSHIP_NOT_FOUND);
    return updated;
  }

  async revokeMemberAccess(inverterId: string, userId: string): Promise<void> {
    const member = await this.getMember(inverterId, userId);
    await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: member.id },
      updatePayload: { status: InverterMemberStatus.DEACTIVATED },
    });
  }
}
