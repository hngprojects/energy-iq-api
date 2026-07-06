jest.mock('../../../config/env', () => ({}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { TeamAccessService } from '../team-access.service';
import {
  InverterMemberStatus,
  InverterRole,
} from '../../../common/enums/inverter-role.enum';
import { SYS_MSG } from '../../../common/constants/sys-msg';
import { InverterMember } from '../entities/inverter-members.entity';
import { InverterMemberModelAction } from '../action/inverter-member.action';
import { InvertersService } from '../../inverters/inverters.service';
import { UsersService } from '../../users/users.service';
import { EmailService } from '../../email/email.service';

// ─── typed helpers for inspecting mock call args ──────────────────────────────

interface CreateCallArgs {
  createPayload: Record<string, unknown>;
}

interface UpdateCallArgs {
  identifierOptions: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
}

interface FindCallArgs {
  findOptions: Record<string, unknown>;
}

function getCreateCall(mock: jest.Mock, callIndex = 0): CreateCallArgs {
  return (mock.mock.calls as unknown[][][])[callIndex][0] as CreateCallArgs;
}

function getUpdateCall(mock: jest.Mock, callIndex = 0): UpdateCallArgs {
  return (mock.mock.calls as unknown[][][])[callIndex][0] as UpdateCallArgs;
}

function getFindCall(mock: jest.Mock, callIndex = 0): FindCallArgs {
  return (mock.mock.calls as unknown[][][])[callIndex][0] as FindCallArgs;
}

// ─── mocks ────────────────────────────────────────────────────────────────────

const mockMemberAction: jest.Mocked<
  Pick<
    InverterMemberModelAction,
    | 'findByInverterIdAndEmail'
    | 'findByTokenAndEmail'
    | 'create'
    | 'update'
    | 'get'
    | 'find'
  >
> = {
  findByInverterIdAndEmail: jest.fn(),
  findByTokenAndEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  get: jest.fn(),
  find: jest.fn(),
};

const mockInvertersService: jest.Mocked<Pick<InvertersService, 'findOne'>> = {
  findOne: jest.fn(),
};

const mockUsersService: jest.Mocked<
  Pick<UsersService, 'findOne' | 'findByEmail'>
> = {
  findOne: jest.fn(),
  findByEmail: jest.fn(),
};

const mockEmailService: jest.Mocked<
  Pick<
    EmailService,
    'sendTeamInviteNewUserEmail' | 'sendTeamInviteExistingUserEmail'
  >
> = {
  sendTeamInviteNewUserEmail: jest.fn(),
  sendTeamInviteExistingUserEmail: jest.fn(),
};

// ─── fixtures ─────────────────────────────────────────────────────────────────

const INVERTER_ID = 'inv-uuid-1';
const INVITER_ID = 'inviter-uuid-1';
const MEMBER_USER_ID = 'member-uuid-1';
const INVITE_TOKEN = 'token-uuid-1';
const MEMBER_ID = 'member-row-uuid-1';

function makeInvite(overrides: Partial<InverterMember> = {}): InverterMember {
  return {
    id: MEMBER_ID,
    inverterId: INVERTER_ID,
    userId: MEMBER_USER_ID,
    email: 'invited@example.com',
    role: InverterRole.VIEWER,
    status: InverterMemberStatus.INVITED,
    invitedById: INVITER_ID,
    inviteToken: INVITE_TOKEN,
    inviteTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  } as InverterMember;
}

// ─── test suite ───────────────────────────────────────────────────────────────

describe('TeamAccessService', () => {
  let service: TeamAccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeamAccessService(
      mockMemberAction as unknown as InverterMemberModelAction,
      mockInvertersService as unknown as InvertersService,
      mockUsersService as unknown as UsersService,
      mockEmailService as unknown as EmailService,
    );

    mockInvertersService.findOne.mockResolvedValue({
      id: INVERTER_ID,
      brand: 'Victron',
      model: 'MultiPlus',
    } as never);
    mockUsersService.findOne.mockResolvedValue({
      id: INVITER_ID,
      firstName: 'John',
      lastName: 'Doe',
    } as never);
  });

  // ── inviteMember ─────────────────────────────────────────────────────────

  describe('inviteMember', () => {
    const dto = { email: 'invited@example.com', role: InverterRole.TECHNICIAN };

    it('throws ConflictException when a membership already exists for the email', async () => {
      mockMemberAction.findByInverterIdAndEmail.mockResolvedValue(makeInvite());
      await expect(
        service.inviteMember(dto, INVERTER_ID, INVITER_ID),
      ).rejects.toThrow(ConflictException);
    });

    describe('Path A — invited email has no existing account', () => {
      beforeEach(() => {
        mockMemberAction.findByInverterIdAndEmail.mockResolvedValue(null);
        mockUsersService.findByEmail.mockResolvedValue(null);
        mockMemberAction.create.mockResolvedValue(makeInvite());
        mockEmailService.sendTeamInviteNewUserEmail.mockResolvedValue(
          undefined,
        );
      });

      it('creates a member row with INVITED status and no userId', async () => {
        await service.inviteMember(dto, INVERTER_ID, INVITER_ID);
        const call = getCreateCall(mockMemberAction.create);
        expect(call.createPayload.status).toBe(InverterMemberStatus.INVITED);
        expect(call.createPayload.userId).toBeUndefined();
      });

      it('stores the invited role on the member row', async () => {
        await service.inviteMember(dto, INVERTER_ID, INVITER_ID);
        const call = getCreateCall(mockMemberAction.create);
        expect(call.createPayload.role).toBe(InverterRole.TECHNICIAN);
      });

      it('sets inviteTokenExpiresAt in the future', async () => {
        await service.inviteMember(dto, INVERTER_ID, INVITER_ID);
        const call = getCreateCall(mockMemberAction.create);
        const expiry = call.createPayload.inviteTokenExpiresAt as Date;
        expect(expiry.getTime()).toBeGreaterThan(Date.now());
      });

      it('sends the new-user invite email, not the existing-user email', async () => {
        await service.inviteMember(dto, INVERTER_ID, INVITER_ID);
        expect(
          mockEmailService.sendTeamInviteNewUserEmail,
        ).toHaveBeenCalledTimes(1);
        expect(
          mockEmailService.sendTeamInviteExistingUserEmail,
        ).not.toHaveBeenCalled();
      });
    });

    describe('Path B — invited email already has an account', () => {
      beforeEach(() => {
        mockMemberAction.findByInverterIdAndEmail.mockResolvedValue(null);
        mockUsersService.findByEmail.mockResolvedValue({
          id: MEMBER_USER_ID,
          firstName: 'Jane',
          email: 'invited@example.com',
        } as never);
        mockMemberAction.create.mockResolvedValue(
          makeInvite({ userId: MEMBER_USER_ID }),
        );
        mockEmailService.sendTeamInviteExistingUserEmail.mockResolvedValue(
          undefined,
        );
      });

      it('creates a member row with INVITED status and the existing userId', async () => {
        await service.inviteMember(dto, INVERTER_ID, INVITER_ID);
        const call = getCreateCall(mockMemberAction.create);
        expect(call.createPayload.status).toBe(InverterMemberStatus.INVITED);
        expect(call.createPayload.userId).toBe(MEMBER_USER_ID);
      });

      it('sends the existing-user invite email, not the new-user email', async () => {
        await service.inviteMember(dto, INVERTER_ID, INVITER_ID);
        expect(
          mockEmailService.sendTeamInviteExistingUserEmail,
        ).toHaveBeenCalledTimes(1);
        expect(
          mockEmailService.sendTeamInviteNewUserEmail,
        ).not.toHaveBeenCalled();
      });
    });
  });

  // ── findInviteByTokenAndEmail ─────────────────────────────────────────────

  describe('findInviteByTokenAndEmail', () => {
    it('returns the member for a valid INVITED record', async () => {
      const invite = makeInvite();
      mockMemberAction.findByTokenAndEmail.mockResolvedValue(invite);
      const result = await service.findInviteByTokenAndEmail(
        INVITE_TOKEN,
        'invited@example.com',
      );
      expect(result).toBe(invite);
    });

    it('throws NotFoundException when no record matches', async () => {
      mockMemberAction.findByTokenAndEmail.mockResolvedValue(null);
      await expect(
        service.findInviteByTokenAndEmail(INVITE_TOKEN, 'invited@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the invite is already ACTIVE', async () => {
      mockMemberAction.findByTokenAndEmail.mockResolvedValue(
        makeInvite({ status: InverterMemberStatus.ACTIVE }),
      );
      await expect(
        service.findInviteByTokenAndEmail(INVITE_TOKEN, 'invited@example.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws with INVITE_TOKEN_EXPIRED when the token is expired', async () => {
      mockMemberAction.findByTokenAndEmail.mockResolvedValue(
        makeInvite({ inviteTokenExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.findInviteByTokenAndEmail(INVITE_TOKEN, 'invited@example.com'),
      ).rejects.toThrow(SYS_MSG.INVITE_TOKEN_EXPIRED);
    });

    it('resolves successfully when the token expires in the future', async () => {
      mockMemberAction.findByTokenAndEmail.mockResolvedValue(
        makeInvite({ inviteTokenExpiresAt: new Date(Date.now() + 60_000) }),
      );
      await expect(
        service.findInviteByTokenAndEmail(INVITE_TOKEN, 'invited@example.com'),
      ).resolves.toBeDefined();
    });

    it('resolves successfully when inviteTokenExpiresAt is not set', async () => {
      mockMemberAction.findByTokenAndEmail.mockResolvedValue(
        makeInvite({ inviteTokenExpiresAt: undefined }),
      );
      await expect(
        service.findInviteByTokenAndEmail(INVITE_TOKEN, 'invited@example.com'),
      ).resolves.toBeDefined();
    });
  });

  // ── activateMembership ───────────────────────────────────────────────────

  describe('activateMembership', () => {
    it('updates the row to ACTIVE status', async () => {
      const invite = makeInvite();
      mockMemberAction.update.mockResolvedValue({
        ...invite,
        status: InverterMemberStatus.ACTIVE,
      });
      await service.activateMembership(invite, MEMBER_USER_ID);
      const call = getUpdateCall(mockMemberAction.update);
      expect(call.updatePayload.status).toBe(InverterMemberStatus.ACTIVE);
    });

    it('sets userId on the row during activation', async () => {
      const invite = makeInvite({ userId: undefined });
      mockMemberAction.update.mockResolvedValue({
        ...invite,
        userId: MEMBER_USER_ID,
        status: InverterMemberStatus.ACTIVE,
      });
      await service.activateMembership(invite, MEMBER_USER_ID);
      const call = getUpdateCall(mockMemberAction.update);
      expect(call.updatePayload.userId).toBe(MEMBER_USER_ID);
    });

    it('expires the invite token when it was still valid at activation', async () => {
      const invite = makeInvite({
        inviteTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      mockMemberAction.update.mockResolvedValue({ ...invite });
      await service.activateMembership(invite, MEMBER_USER_ID);
      const call = getUpdateCall(mockMemberAction.update);
      const expiry = call.updatePayload.inviteTokenExpiresAt as Date;
      // Token should be invalidated — expiry set to now (with small tolerance)
      expect(expiry.getTime()).toBeLessThanOrEqual(Date.now() + 100);
    });

    it('throws NotFoundException when update returns null', async () => {
      mockMemberAction.update.mockResolvedValue(null);
      await expect(
        service.activateMembership(makeInvite(), MEMBER_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMember ────────────────────────────────────────────────────────────

  describe('getMember', () => {
    it('returns the member when found', async () => {
      const member = makeInvite({ status: InverterMemberStatus.ACTIVE });
      mockMemberAction.get.mockResolvedValue(member);
      await expect(service.getMember(INVERTER_ID, MEMBER_ID)).resolves.toBe(
        member,
      );
    });

    it('throws NotFoundException when no member found', async () => {
      mockMemberAction.get.mockResolvedValue(null);
      await expect(service.getMember(INVERTER_ID, MEMBER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateMemberRole ─────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    it('updates the role to the new value', async () => {
      const member = makeInvite({ status: InverterMemberStatus.ACTIVE });
      mockMemberAction.get.mockResolvedValue(member);
      mockMemberAction.update.mockResolvedValue({
        ...member,
        role: InverterRole.ADMIN,
      });
      const result = await service.updateMemberRole(
        INVERTER_ID,
        MEMBER_ID,
        InverterRole.ADMIN,
      );
      expect(result.role).toBe(InverterRole.ADMIN);
      const call = getUpdateCall(mockMemberAction.update);
      expect(call.updatePayload.role).toBe(InverterRole.ADMIN);
    });

    it('throws NotFoundException when update returns null', async () => {
      mockMemberAction.get.mockResolvedValue(makeInvite());
      mockMemberAction.update.mockResolvedValue(null);
      await expect(
        service.updateMemberRole(INVERTER_ID, MEMBER_ID, InverterRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── revokeMemberAccess ───────────────────────────────────────────────────

  describe('revokeMemberAccess', () => {
    it('sets member status to DEACTIVATED', async () => {
      const member = makeInvite({ status: InverterMemberStatus.ACTIVE });
      mockMemberAction.get.mockResolvedValue(member);
      mockMemberAction.update.mockResolvedValue({
        ...member,
        status: InverterMemberStatus.DEACTIVATED,
      });
      await service.revokeMemberAccess(INVERTER_ID, MEMBER_ID);
      const call = getUpdateCall(mockMemberAction.update);
      expect(call.updatePayload.status).toBe(InverterMemberStatus.DEACTIVATED);
    });
  });

  // ── getUserMemberships ───────────────────────────────────────────────────

  describe('getUserMemberships', () => {
    it('queries with userId and ACTIVE status', async () => {
      mockMemberAction.find.mockResolvedValue({ payload: [] } as never);
      await service.getUserMemberships(MEMBER_USER_ID);
      const call = getFindCall(mockMemberAction.find);
      expect(call.findOptions).toMatchObject({
        userId: MEMBER_USER_ID,
        status: InverterMemberStatus.ACTIVE,
      });
    });
  });

  // ── getUserInvites ───────────────────────────────────────────────────────

  describe('getUserInvites', () => {
    it('queries with userId and INVITED status', async () => {
      mockMemberAction.find.mockResolvedValue({ payload: [] } as never);
      await service.getUserInvites(MEMBER_USER_ID);
      const call = getFindCall(mockMemberAction.find);
      expect(call.findOptions).toMatchObject({
        userId: MEMBER_USER_ID,
        status: InverterMemberStatus.INVITED,
      });
    });
  });
});
