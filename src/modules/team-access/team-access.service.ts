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
import { Inverter } from '../inverters/entities/inverters.entity';
import { User } from '../users/entities/user.entity';

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

    if (existing && existing.status !== InverterMemberStatus.DEACTIVATED)
      throw new ConflictException(
        'Pending invite or membership exists for this user',
      );

    /**
     * If a previously-revoked record exists, reuse/reactivate it instead
     * of creating a duplicate row for the same (inverterId, email) pair
     */

    if (existing && existing.status === InverterMemberStatus.DEACTIVATED) {
      const newInviteToken = randomUUID();

      const reInvited =
        await this.inverterMemberModelAction.atomicReInviteExistingRecord(
          existing.id,
          dto.role,
          newInviteToken,
          invitedById,
          new Date(Date.now() + INVITE_TTL_MS),
        );

      return reInvited;
    }

    const inverter = await this.invertersService.findOne(inverterId);
    const inviter = await this.usersService.findOne(invitedById);

    const existingUser = await this.usersService.findByEmail(dto.email);

    let member: InverterMember;
    if (existingUser) {
      member = await this.invite(inverter, dto, inviter, existingUser);
    } else {
      member = await this.invite(inverter, dto, inviter);
    }

    return member;
  }

  async refreshUserInvite(
    inviteId: string,
    inverterId: string,
    userId: string,
  ): Promise<InverterMember> {
    const [caller, inverter] = await Promise.all([
      this.usersService.findOne(userId),
      this.invertersService.findOne(inverterId),
    ]);
    const newToken = randomUUID();

    const updated = await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: {
        id: inviteId,
        status: InverterMemberStatus.INVITED,
        inverterId,
      },
      updatePayload: {
        inviteToken: newToken,
        inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    if (!updated)
      throw new NotFoundException(
        'No invite exists with this id or user already accepted',
      );

    const inviterName = `${caller.firstName} ${caller.lastName}`;
    const inverterName = `${inverter.brand} ${inverter.model}`;

    if (updated.userId) {
      const existingUser = await this.usersService.findOne(updated.userId);
      await this.emailService.sendTeamInviteExistingUserEmail(
        updated.email,
        existingUser.firstName,
        inviterName,
        inverterName,
        updated.role,
        updated.inviteToken,
      );
    } else {
      await this.emailService.sendTeamInviteNewUserEmail(
        updated.email,
        inviterName,
        inverterName,
        updated.role,
        updated.inviteToken,
      );
    }

    return updated;
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

  async activateMembership(
    invite: InverterMember,
    userId: string,
  ): Promise<void> {
    const updated = await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: invite.id },
      updatePayload: {
        status: InverterMemberStatus.ACTIVE,
        inviteTokenExpiresAt: new Date(),
        userId,
      },
    });

    if (!updated)
      throw new NotFoundException(SYS_MSG.INVERTER_MEMBERSHIP_NOT_FOUND);
  }

  async listMembers(
    inverterId: string,
    page?: number,
    limit?: number,
  ): Promise<InverterMember[]> {
    const members = await this.inverterMemberModelAction.find({
      ...noTransaction(),
      findOptions: {
        inverterId,
        status: InverterMemberStatus.ACTIVE,
      },
      paginationPayload: {
        page: page ?? 1,
        limit: limit ?? 100,
      },
    });

    return members.payload;
  }

  async getMember(
    inverterId: string,
    memberId: string,
  ): Promise<InverterMember> {
    const member = await this.inverterMemberModelAction.get({
      identifierOptions: { inverterId, id: memberId },
    });
    if (!member)
      throw new NotFoundException(SYS_MSG.INVERTER_MEMBERSHIP_NOT_FOUND);
    return member;
  }

  async getUserInvites(
    userId: string,
    page?: number,
  ): Promise<InverterMember[]> {
    const invites = await this.inverterMemberModelAction.find({
      ...noTransaction(),
      findOptions: {
        userId,
        status: InverterMemberStatus.INVITED,
      },
      paginationPayload: {
        page: page ?? 1,
        limit: 100,
      },
    });

    return invites.payload;
  }

  async getUserMemberships(
    userId: string,
    page?: number,
  ): Promise<InverterMember[]> {
    const invites = await this.inverterMemberModelAction.find({
      ...noTransaction(),
      findOptions: {
        userId,
        status: InverterMemberStatus.ACTIVE,
      },
      paginationPayload: {
        page: page ?? 1,
        limit: 100,
      },
    });

    return invites.payload;
  }

  async updateMemberRole(
    inverterId: string,
    memberId: string,
    role: InverterRole,
  ): Promise<InverterMember> {
    const member = await this.getMember(inverterId, memberId);

    const updated = await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: member.id },
      updatePayload: { role },
    });
    if (!updated)
      throw new NotFoundException(SYS_MSG.INVERTER_MEMBERSHIP_NOT_FOUND);

    return updated;
  }

  async revokeMemberAccess(
    inverterId: string,
    memberId: string,
  ): Promise<void> {
    const member = await this.getMember(inverterId, memberId);
    await this.inverterMemberModelAction.update({
      ...noTransaction(),
      identifierOptions: { id: member.id },
      updatePayload: { status: InverterMemberStatus.DEACTIVATED },
    });
  }

  private async invite(
    inverter: Inverter,
    dto: InviteMemberDto,
    inviter: User,
    existingUser?: User,
  ): Promise<InverterMember> {
    const inviteToken = randomUUID();
    const member = await this.inverterMemberModelAction.create({
      ...noTransaction(),
      createPayload: {
        inverterId: inverter.id,
        // userId: existingUser.id,
        ...(existingUser && { userId: existingUser.id }),
        email: dto.email,
        role: dto.role,
        status: InverterMemberStatus.INVITED,
        invitedById: inviter.id,
        inviteToken,
        inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const inviterName = `${inviter.firstName} ${inviter.lastName}`;
    const inverterName = `${inverter.brand} ${inverter.model}`;

    // Send email that user can now accept access
    if (existingUser) {
      await this.emailService.sendTeamInviteExistingUserEmail(
        member.email,
        existingUser.firstName,
        inviterName,
        inverterName,
        dto.role,
        member.inviteToken,
      );
    } else {
      await this.emailService.sendTeamInviteNewUserEmail(
        member.email,
        inviterName,
        inverterName,
        dto.role,
        member.inviteToken,
      );
    }

    return member;
  }
}
