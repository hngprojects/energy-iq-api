jest.mock('../../../config/env', () => ({}));

/**
 * RBAC integration tests for TeamAccessController.
 *
 * Strategy: We mount the controller in a minimal NestJS testing module,
 * override InverterRoleGuard with a controllable stub, and verify:
 *   - which routes require ADMIN-level access (guard denial → 403)
 *   - which routes bypass the guard (@InverterOutsider)
 *   - that the correct service method is called with the right params
 */

import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import supertest from 'supertest';
import type { Agent } from 'supertest';
import type { Server } from 'http';
import { TeamAccessController } from '../team-access.controller';
import { TeamAccessService } from '../team-access.service';
import { InverterRoleGuard } from '../../../common/guards/inverter-role.guard';
import { InverterRole } from '../../../common/enums/inverter-role.enum';
import { InverterMember } from '../entities/inverter-members.entity';

// ─── fixtures ─────────────────────────────────────────────────────────────────

const INVERTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MEMBER_ID = 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
const USER_ID = 'c1b2c3d4-e5f6-7890-abcd-ef1234567892';

const fakeMember = {
  id: MEMBER_ID,
  inverterId: INVERTER_ID,
  userId: USER_ID,
  email: 'member@example.com',
  role: InverterRole.VIEWER,
} as InverterMember;

// ─── guard stubs ──────────────────────────────────────────────────────────────

const allowGuard = { canActivate: (): boolean => true };

const denyGuard = {
  canActivate: (): never => {
    throw new ForbiddenException('Forbidden resource');
  },
};

// ─── mock service ─────────────────────────────────────────────────────────────

const mockTeamAccessService: jest.Mocked<
  Pick<
    TeamAccessService,
    | 'getUserInvites'
    | 'getUserMemberships'
    | 'inviteMember'
    | 'listMembers'
    | 'getMember'
    | 'updateMemberRole'
    | 'revokeMemberAccess'
    | 'refreshUserInvite'
  >
> = {
  getUserInvites: jest.fn(),
  getUserMemberships: jest.fn(),
  inviteMember: jest.fn(),
  listMembers: jest.fn(),
  getMember: jest.fn(),
  updateMemberRole: jest.fn(),
  revokeMemberAccess: jest.fn(),
  refreshUserInvite: jest.fn(),
};

// ─── helpers ──────────────────────────────────────────────────────────────────

async function buildApp(guard: {
  canActivate: (...args: unknown[]) => unknown;
}): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [TeamAccessController],
    providers: [
      { provide: TeamAccessService, useValue: mockTeamAccessService },
    ],
  })
    .overrideGuard(InverterRoleGuard)
    .useValue(guard)
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

function agent(app: INestApplication): Agent {
  return supertest.agent(app.getHttpServer() as Server);
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('TeamAccessController — RBAC', () => {
  let allowedApp: INestApplication;
  let deniedApp: INestApplication;

  beforeAll(async () => {
    [allowedApp, deniedApp] = await Promise.all([
      buildApp(allowGuard),
      buildApp(denyGuard),
    ]);
  });

  afterAll(async () => {
    await Promise.all([allowedApp.close(), deniedApp.close()]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTeamAccessService.getUserInvites.mockResolvedValue([]);
    mockTeamAccessService.getUserMemberships.mockResolvedValue([]);
    mockTeamAccessService.inviteMember.mockResolvedValue(fakeMember);
    mockTeamAccessService.listMembers.mockResolvedValue([fakeMember]);
    mockTeamAccessService.getMember.mockResolvedValue(fakeMember);
    mockTeamAccessService.updateMemberRole.mockResolvedValue(fakeMember);
    mockTeamAccessService.revokeMemberAccess.mockResolvedValue(undefined);
    mockTeamAccessService.refreshUserInvite.mockResolvedValue(fakeMember);
  });

  // ── @InverterOutsider routes ──────────────────────────────────────────────

  describe('GET /team-access/invites (@InverterOutsider)', () => {
    it('is reachable and returns 200', async () => {
      await agent(allowedApp).get('/team-access/invites').expect(200);
    });

    it('calls getUserInvites on the service', async () => {
      await agent(allowedApp).get('/team-access/invites').expect(200);
      expect(mockTeamAccessService.getUserInvites).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /team-access/memberships (@InverterOutsider)', () => {
    it('is reachable and returns 200', async () => {
      await agent(allowedApp).get('/team-access/memberships').expect(200);
    });

    it('calls getUserMemberships on the service', async () => {
      await agent(allowedApp).get('/team-access/memberships').expect(200);
      expect(mockTeamAccessService.getUserMemberships).toHaveBeenCalledTimes(1);
    });
  });

  // ── ADMIN-only routes — guard denied → 403 ───────────────────────────────

  describe('ADMIN-required routes return 403 when guard denies', () => {
    it('POST /:inverterId/invite', async () => {
      await agent(deniedApp)
        .post(`/team-access/${INVERTER_ID}/invite`)
        .send({ email: 'x@x.com', role: InverterRole.VIEWER })
        .expect(403);
    });

    it('GET /:inverterId', async () => {
      await agent(deniedApp).get(`/team-access/${INVERTER_ID}`).expect(403);
    });

    it('GET /:inverterId/:memberId', async () => {
      await agent(deniedApp)
        .get(`/team-access/${INVERTER_ID}/${MEMBER_ID}`)
        .expect(403);
    });

    it('PATCH /:inverterId/:memberId', async () => {
      await agent(deniedApp)
        .patch(`/team-access/${INVERTER_ID}/${MEMBER_ID}`)
        .send({ role: InverterRole.ADMIN })
        .expect(403);
    });

    it('DELETE /:inverterId/:memberId', async () => {
      await agent(deniedApp)
        .delete(`/team-access/${INVERTER_ID}/${MEMBER_ID}`)
        .expect(403);
    });
  });

  // ── ADMIN-only routes — guard allowed → handler reached ──────────────────

  describe('ADMIN-required routes reach handler when guard allows', () => {
    it('POST /:inverterId/invite — calls inviteMember', async () => {
      await agent(allowedApp)
        .post(`/team-access/${INVERTER_ID}/invite`)
        .send({ email: 'new@example.com', role: InverterRole.TECHNICIAN })
        .expect(201);
      expect(mockTeamAccessService.inviteMember).toHaveBeenCalledWith(
        { email: 'new@example.com', role: InverterRole.TECHNICIAN },
        INVERTER_ID,
        undefined, // CurrentUser is undefined without JWT in test context
      );
    });

    it('GET /:inverterId — calls listMembers', async () => {
      await agent(allowedApp).get(`/team-access/${INVERTER_ID}`).expect(200);
      expect(mockTeamAccessService.listMembers).toHaveBeenCalledWith(
        INVERTER_ID,
      );
    });

    it('GET /:inverterId/:memberId — calls getMember', async () => {
      await agent(allowedApp)
        .get(`/team-access/${INVERTER_ID}/${MEMBER_ID}`)
        .expect(200);
      expect(mockTeamAccessService.getMember).toHaveBeenCalledWith(
        INVERTER_ID,
        MEMBER_ID,
      );
    });

    it('PATCH /:inverterId/:memberId — calls updateMemberRole', async () => {
      mockTeamAccessService.updateMemberRole.mockResolvedValue({
        ...fakeMember,
        role: InverterRole.ADMIN,
      });
      await agent(allowedApp)
        .patch(`/team-access/${INVERTER_ID}/${MEMBER_ID}`)
        .send({ role: InverterRole.ADMIN })
        .expect(200);
      expect(mockTeamAccessService.updateMemberRole).toHaveBeenCalledWith(
        INVERTER_ID,
        MEMBER_ID,
        InverterRole.ADMIN,
      );
    });

    it('DELETE /:inverterId/:memberId — calls revokeMemberAccess', async () => {
      await agent(allowedApp)
        .delete(`/team-access/${INVERTER_ID}/${MEMBER_ID}`)
        .expect(200);
      expect(mockTeamAccessService.revokeMemberAccess).toHaveBeenCalledWith(
        INVERTER_ID,
        MEMBER_ID,
      );
    });
  });

  // ── input validation ─────────────────────────────────────────────────────

  describe('input validation', () => {
    it('POST /:inverterId/invite — 400 when role is invalid', async () => {
      await agent(allowedApp)
        .post(`/team-access/${INVERTER_ID}/invite`)
        .send({ email: 'valid@example.com', role: 'super_admin' })
        .expect(400);
    });

    it('POST /:inverterId/invite — 400 when email is missing', async () => {
      await agent(allowedApp)
        .post(`/team-access/${INVERTER_ID}/invite`)
        .send({ role: InverterRole.VIEWER })
        .expect(400);
    });

    it('PATCH /:inverterId/:memberId — 400 when role is invalid', async () => {
      await agent(allowedApp)
        .patch(`/team-access/${INVERTER_ID}/${MEMBER_ID}`)
        .send({ role: 'not_a_role' })
        .expect(400);
    });
  });
});
