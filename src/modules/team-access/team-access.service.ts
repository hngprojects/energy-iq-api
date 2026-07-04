import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InverterMember } from './entities/inverter-members.entity';
import { InviteMemberDto } from './dto/invite-member.dto';
import { InverterMemberModelAction } from './action/inverter-member.action';
import { SYS_MSG } from '../../common/constants/sys-msg';
import { InvertersService } from '../inverters/inverters.service';
import { UsersService } from '../users/users.service';
import { noTransaction } from '../../common/constants/transaction-options';
import {
  InverterMemberStatus,
  InverterRole,
} from '../../common/enums/inverter-role.enum';
import { randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class TeamAccessService {
  constructor(
    private readonly inverterMemberModelAction: InverterMemberModelAction,
    private readonly invertersService: InvertersService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  async inviteMember(
    dto: InviteMemberDto,
    inverterId: string,
    invitedById: string,
  ): Promise<InverterMember> {
    const existing =
      await this.inverterMemberModelAction.findByInverterIdAndEmail(
        inverterId,
        dto.email,
      );

    if (existing) throw new ConflictException(SYS_MSG.CONFLICT);

    const inverter = await this.invertersService.findOne(inverterId);
    const inviter = await this.usersService.findOne(invitedById);

    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser) {
      const inviteToken = randomUUID();
      const member = await this.inverterMemberModelAction.create({
        ...noTransaction(),
        createPayload: {
          inverterId,
          userId: existingUser.id,
          email: dto.email,
          role: dto.role,
          status: InverterMemberStatus.INVITED,
          invitedById,
          inviteToken,
          inviteTokenExpiresAt: new Date(INVITE_TTL_MS),
        },
      });

      const inviterName = `${inviter.firstName} ${inviter.lastName}`;
      const inverterName = `${inverter.brand} ${inverter.model}`;

      // Send email that user can now accept access
      await this.emailService.sendTeamInviteExistingUserEmail(
        member.email,
        existingUser.firstName,
        inviterName,
        inverterName,
        dto.role,
        member.inviteToken,
      );

      return member;
    }

    const inviteToken = randomUUID();
    const member = await this.inverterMemberModelAction.create({
      ...noTransaction(),
      createPayload: {
        inverterId,
        email: dto.email,
        role: dto.role,
        status: InverterMemberStatus.INVITED,
        invitedById,
        inviteToken,
        inviteTokenExpiresAt: new Date(INVITE_TTL_MS),
      },
    });

    const inviterName = `${inviter.firstName} ${inviter.lastName}`;
    const inverterName = `${inverter.brand} ${inverter.model}`;

    // Send them an email, they'd have to register and accept invite in one step
    await this.emailService.sendTeamInviteNewUserEmail(
      member.email,
      inviterName,
      inverterName,
      dto.role,
      member.inviteToken,
    );

    return member;
  }

  async findInviteByTokenAndEmail(
    token: string,
    email: string,
  ): Promise<InverterMember> {
    const member = await this.inverterMemberModelAction.findByTokenAndEmail(
      token,
      email,
    );

    if (!member)
      throw new NotFoundException(SYS_MSG.INVERTER_MEMBERSHIP_NOT_FOUND);
    if (member.status !== InverterMemberStatus.INVITED)
      throw new ConflictException(SYS_MSG.INVITE_ALREADY_ACCEPTED);
    if (
      member.inviteTokenExpiresAt &&
      Date.now() > member.inviteTokenExpiresAt.getTime()
    )
      throw new ConflictException(SYS_MSG.INVITE_TOKEN_EXPIRED);

    return member;
  }

  async activateMembership(invite: InverterMember): Promise<void> {
    const updated = await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: invite.id },
      updatePayload: {
        status: InverterMemberStatus.ACTIVE,
        ...(invite.inviteTokenExpiresAt &&
          Date.now() < invite.inviteTokenExpiresAt.getTime() && {
            inviteTokenExpiresAt: new Date(Date.now()),
          }),
      },
    });

    if (!updated)
      throw new NotFoundException(SYS_MSG.INVERTER_MEMBERSHIP_NOT_FOUND);
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
