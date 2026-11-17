import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, sqlOf } from '../../test-utils/prisma-mock';
import { NotificationsService } from '../notifications/notifications.service';
import { InvitationsService } from './invitations.service';

const OWNER_ID = 'owner-1';
const PROJECT_ID = 'project-1';
const INVITED_ID = 'user-2';
const INVITED_EMAIL = 'ana@qualio.test';

describe('InvitationsService', () => {
  let prisma: PrismaMock;
  let notifications: { createForUsers: jest.Mock };
  let service: InvitationsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    notifications = { createForUsers: jest.fn().mockResolvedValue(undefined) };
    service = new InvitationsService(asPrisma(prisma), notifications as unknown as NotificationsService);
  });

  /** Queues ownership check, project owner lookup and owner email lookup. */
  function queueOwnerChecks(ownerEmail = 'owner@qualio.test') {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: PROJECT_ID }])
      .mockResolvedValueOnce([{ ownerId: OWNER_ID }])
      .mockResolvedValueOnce([{ email: ownerEmail }]);
  }

  describe('create', () => {
    it('rejects users who do not own the project', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.create(OWNER_ID, PROJECT_ID, { email: INVITED_EMAIL })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not allow inviting the project owner', async () => {
      queueOwnerChecks(INVITED_EMAIL);

      await expect(service.create(OWNER_ID, PROJECT_ID, { email: ' ANA@qualio.test ' })).rejects.toThrow(
        'No puedes invitar al propietario del proyecto.',
      );
    });

    it('rejects emails without a registered account', async () => {
      queueOwnerChecks();
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.create(OWNER_ID, PROJECT_ID, { email: INVITED_EMAIL })).rejects.toThrow(
        'No existe una cuenta con ese correo.',
      );
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('rejects a second pending invitation for the same person', async () => {
      queueOwnerChecks();
      prisma.$queryRaw.mockResolvedValueOnce([{ id: INVITED_ID }]).mockResolvedValueOnce([{ id: 'inv-old' }]);

      await expect(service.create(OWNER_ID, PROJECT_ID, { email: INVITED_EMAIL })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects people who are already members', async () => {
      queueOwnerChecks();
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: INVITED_ID }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'member-1' }]);

      await expect(service.create(OWNER_ID, PROJECT_ID, { email: INVITED_EMAIL })).rejects.toThrow(
        'Esta persona ya participa en el proyecto.',
      );
    });

    it('stores a pending invitation and notifies the invited user', async () => {
      queueOwnerChecks();
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: INVITED_ID }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'inv-1', status: 'PENDING', invitedEmail: INVITED_EMAIL }])
        .mockResolvedValueOnce([{ projectName: 'Qualio Web', inviterName: 'Owner', inviterEmail: 'owner@qualio.test' }]);

      const invitation = await service.create(OWNER_ID, PROJECT_ID, { email: INVITED_EMAIL });

      expect(invitation).toMatchObject({ id: 'inv-1', status: 'PENDING' });
      expect(sqlOf(prisma.$executeRaw.mock.calls[0])).toContain("'PENDING'");
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        [INVITED_ID],
        expect.objectContaining({ type: 'INVITATION_PENDING', entityId: 'inv-1' }),
      );
    });
  });

  describe('accept and reject', () => {
    it('adds the user as project member and notifies the owner on accept', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ projectId: PROJECT_ID, role: 'MEMBER', status: 'PENDING' }])
        .mockResolvedValueOnce([{ name: 'Ana', email: INVITED_EMAIL }])
        .mockResolvedValueOnce([{ ownerId: OWNER_ID, projectName: 'Qualio Web' }]);

      await expect(service.accept(INVITED_ID, INVITED_EMAIL, 'inv-1')).resolves.toEqual({ success: true });

      const statements = prisma.$executeRaw.mock.calls.map(sqlOf);
      expect(statements.some((sql) => sql.includes("SET status = 'ACCEPTED'"))).toBe(true);
      expect(statements.some((sql) => sql.includes('INSERT INTO project_members'))).toBe(true);
      expect(notifications.createForUsers).toHaveBeenCalledWith(
        [OWNER_ID],
        expect.objectContaining({ type: 'INVITATION_ACCEPTED' }),
      );
    });

    it('marks the invitation as rejected without creating a membership', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ projectId: PROJECT_ID, role: 'MEMBER', status: 'PENDING' }])
        .mockResolvedValueOnce([{ name: 'Ana', email: INVITED_EMAIL }])
        .mockResolvedValueOnce([{ ownerId: OWNER_ID, projectName: 'Qualio Web' }]);

      await service.reject(INVITED_ID, INVITED_EMAIL, 'inv-1');

      const statements = prisma.$executeRaw.mock.calls.map(sqlOf);
      expect(statements.some((sql) => sql.includes("SET status = 'REJECTED'"))).toBe(true);
      expect(statements.some((sql) => sql.includes('project_members'))).toBe(false);
    });

    it('refuses to process an invitation twice', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ projectId: PROJECT_ID, role: 'MEMBER', status: 'ACCEPTED' }]);

      await expect(service.accept(INVITED_ID, INVITED_EMAIL, 'inv-1')).rejects.toThrow('La invitación ya fue procesada.');
    });

    it('refuses invitations that belong to another user', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.reject(INVITED_ID, INVITED_EMAIL, 'inv-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('cancelByProject', () => {
    it('only cancels pending invitations', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: PROJECT_ID }]).mockResolvedValueOnce([{ id: 'inv-1', status: 'ACCEPTED' }]);

      await expect(service.cancelByProject(OWNER_ID, PROJECT_ID, 'inv-1')).rejects.toThrow(
        'Solo se pueden cancelar invitaciones pendientes.',
      );
    });

    it('throws NotFound for unknown invitations', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: PROJECT_ID }]).mockResolvedValueOnce([]);

      await expect(service.cancelByProject(OWNER_ID, PROJECT_ID, 'inv-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes the invitation and its notification', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: PROJECT_ID }]).mockResolvedValueOnce([{ id: 'inv-1', status: 'PENDING' }]);

      await expect(service.cancelByProject(OWNER_ID, PROJECT_ID, 'inv-1')).resolves.toEqual({ success: true });
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    });
  });
});
