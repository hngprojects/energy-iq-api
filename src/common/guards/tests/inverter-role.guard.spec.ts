jest.mock('../../../config/env', () => ({}));

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InverterRoleGuard } from '../inverter-role.guard';
import {
  InverterRole,
  InverterMemberStatus,
  INVERTER_ROLE_RANK,
} from '../../enums/inverter-role.enum';
import { IS_INVERTER_OUTSIDER_KEY } from '../../decorators/inverter-outsider.decorator';
import { INVERTER_ROLES_KEY } from '../../decorators/inverter-roles.decorator';
import { InverterMemberModelAction } from '../../../modules/team-access/action/inverter-member.action';
import { InvertersService } from '../../../modules/inverters/inverters.service';

// ─── typed mocks ──────────────────────────────────────────────────────────────

const mockMemberAction: jest.Mocked<Pick<InverterMemberModelAction, 'get'>> = {
  get: jest.fn(),
};

const mockInvertersService: jest.Mocked<Pick<InvertersService, 'findOne'>> = {
  findOne: jest.fn(),
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildContext(
  params: Record<string, string>,
  user: { sub: string } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ params, user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

const INVERTER_ID = 'inv-uuid-1';
const OWNER_ID = 'owner-uuid-1';
const MEMBER_ID = 'member-uuid-1';
const STRANGER_ID = 'stranger-uuid-1';

function makeReflector(
  isOutsider: boolean,
  requiredRoles: InverterRole[] | undefined,
): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => {
      if (key === IS_INVERTER_OUTSIDER_KEY) return isOutsider;
      if (key === INVERTER_ROLES_KEY) return requiredRoles;
      return undefined;
    }),
  } as unknown as Reflector;
}

function makeGuard(
  isOutsider = false,
  requiredRoles: InverterRole[] | undefined = undefined,
): InverterRoleGuard {
  return new InverterRoleGuard(
    mockMemberAction as unknown as InverterMemberModelAction,
    makeReflector(isOutsider, requiredRoles),
    mockInvertersService as unknown as InvertersService,
  );
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('InverterRoleGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvertersService.findOne.mockResolvedValue({
      userId: OWNER_ID,
    } as never);
  });

  // ── @InverterOutsider bypass ──────────────────────────────────────────────

  describe('@InverterOutsider decorator', () => {
    it('returns true immediately without any DB calls', async () => {
      const guard = makeGuard(true);
      const ctx = buildContext({}, { sub: 'anyone' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockInvertersService.findOne).not.toHaveBeenCalled();
      expect(mockMemberAction.get).not.toHaveBeenCalled();
    });
  });

  // ── missing request data ──────────────────────────────────────────────────

  describe('missing request data', () => {
    it('throws TypeError when inverterId param is absent (guard calls .toString() on undefined)', async () => {
      const guard = makeGuard();
      const ctx = buildContext({}, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).rejects.toThrow(TypeError);
    });

    it('returns false when user is not authenticated', async () => {
      const guard = makeGuard();
      // inverterId is present so .toString() won't throw before the user check
      const ctx = buildContext({ inverterId: INVERTER_ID }, undefined);
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  // ── owner shortcut ────────────────────────────────────────────────────────

  describe('inverter owner', () => {
    it('allows the owner without checking membership', async () => {
      const guard = makeGuard(false, [InverterRole.ADMIN]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: OWNER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockMemberAction.get).not.toHaveBeenCalled();
    });

    it('allows the owner even on a VIEWER-only route', async () => {
      const guard = makeGuard(false, [InverterRole.VIEWER]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: OWNER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  // ── non-member ────────────────────────────────────────────────────────────

  describe('non-member', () => {
    beforeEach(() => {
      mockMemberAction.get.mockResolvedValue(null);
    });

    it('throws ForbiddenException', async () => {
      const guard = makeGuard();
      const ctx = buildContext(
        { inverterId: INVERTER_ID },
        { sub: STRANGER_ID },
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('throws with the correct FORBIDDEN message', async () => {
      const guard = makeGuard();
      const ctx = buildContext(
        { inverterId: INVERTER_ID },
        { sub: STRANGER_ID },
      );
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        'You do not have permission to access this resource',
      );
    });
  });

  // ── route with no role requirement ────────────────────────────────────────

  describe('route with no @InverterRoles decorator', () => {
    it('allows any active member', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.VIEWER,
        status: InverterMemberStatus.ACTIVE,
      } as never);
      const guard = makeGuard(false, undefined);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  // ── exact role matching ───────────────────────────────────────────────────

  describe('exact role matching', () => {
    it('allows ADMIN on an ADMIN-required route', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.ADMIN,
      } as never);
      const guard = makeGuard(false, [InverterRole.ADMIN]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('denies VIEWER on an ADMIN-required route', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.VIEWER,
      } as never);
      const guard = makeGuard(false, [InverterRole.ADMIN]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });

    it('denies TECHNICIAN on an ADMIN-required route', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.TECHNICIAN,
      } as never);
      const guard = makeGuard(false, [InverterRole.ADMIN]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  // ── rank hierarchy ────────────────────────────────────────────────────────

  describe('rank hierarchy', () => {
    it('ADMIN satisfies a VIEWER requirement', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.ADMIN,
      } as never);
      const guard = makeGuard(false, [InverterRole.VIEWER]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('ADMIN satisfies a TECHNICIAN requirement', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.ADMIN,
      } as never);
      const guard = makeGuard(false, [InverterRole.TECHNICIAN]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('TECHNICIAN satisfies a VIEWER requirement', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.TECHNICIAN,
      } as never);
      const guard = makeGuard(false, [InverterRole.VIEWER]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('VIEWER does NOT satisfy a TECHNICIAN requirement', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.VIEWER,
      } as never);
      const guard = makeGuard(false, [InverterRole.TECHNICIAN]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });

    it('VIEWER does NOT satisfy an ADMIN requirement', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.VIEWER,
      } as never);
      const guard = makeGuard(false, [InverterRole.ADMIN]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  // ── rank constant values ──────────────────────────────────────────────────

  describe('INVERTER_ROLE_RANK', () => {
    it('ADMIN has the highest rank', () => {
      expect(INVERTER_ROLE_RANK[InverterRole.ADMIN]).toBeGreaterThan(
        INVERTER_ROLE_RANK[InverterRole.TECHNICIAN],
      );
      expect(INVERTER_ROLE_RANK[InverterRole.ADMIN]).toBeGreaterThan(
        INVERTER_ROLE_RANK[InverterRole.VIEWER],
      );
    });

    it('TECHNICIAN rank is between ADMIN and VIEWER', () => {
      expect(INVERTER_ROLE_RANK[InverterRole.TECHNICIAN]).toBeGreaterThan(
        INVERTER_ROLE_RANK[InverterRole.VIEWER],
      );
      expect(INVERTER_ROLE_RANK[InverterRole.TECHNICIAN]).toBeLessThan(
        INVERTER_ROLE_RANK[InverterRole.ADMIN],
      );
    });
  });

  // ── DB lookup params ──────────────────────────────────────────────────────

  describe('membership DB lookup', () => {
    it('queries with the correct inverterId, userId, and ACTIVE status', async () => {
      mockMemberAction.get.mockResolvedValue({
        role: InverterRole.VIEWER,
      } as never);
      const guard = makeGuard(false, [InverterRole.VIEWER]);
      const ctx = buildContext({ inverterId: INVERTER_ID }, { sub: MEMBER_ID });
      await guard.canActivate(ctx);
      expect(mockMemberAction.get).toHaveBeenCalledWith({
        identifierOptions: {
          inverterId: INVERTER_ID,
          userId: MEMBER_ID,
          status: InverterMemberStatus.ACTIVE,
        },
      });
    });
  });
});
