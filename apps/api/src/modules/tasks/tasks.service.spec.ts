import { ForbiddenException } from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, valuesOf } from '../../test-utils/prisma-mock';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectMembersService } from '../project-members/project-members.service';
import { TasksService } from './tasks.service';

const OWNER_ID = 'owner-1';
const PROJECT_ID = 'project-1';

describe('TasksService.create', () => {
  let prisma: PrismaMock;
  let members: { ensureParticipant: jest.Mock };
  let notifications: { notifyProjectAudience: jest.Mock };
  let service: TasksService;

  beforeEach(() => {
    prisma = createPrismaMock();
    members = { ensureParticipant: jest.fn().mockResolvedValue(undefined) };
    notifications = { notifyProjectAudience: jest.fn().mockResolvedValue(undefined) };
    service = new TasksService(
      asPrisma(prisma),
      members as unknown as ProjectMembersService,
      notifications as unknown as NotificationsService,
    );
  });

  it('rejects users who do not own the project', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.create(OWNER_ID, PROJECT_ID, { title: 'Login' } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates the task in the general backlog with a project-scoped key', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: PROJECT_ID }])
      .mockResolvedValueOnce([{ nextPosition: 4 }])
      .mockResolvedValueOnce([{ name: 'Qualio Web!' }])
      .mockResolvedValueOnce([{ nextValue: 7 }])
      .mockResolvedValueOnce([{ id: 'task-1', itemKey: 'QualioWeb-007' }]);

    const created = await service.create(OWNER_ID, PROJECT_ID, { title: '  Login  ' } as never);

    expect(created.itemKey).toBe('QualioWeb-007');
    const insertValues = valuesOf(prisma.$queryRaw.mock.calls[4]);
    expect(insertValues).toEqual(expect.arrayContaining(['QualioWeb-007', 'Login', 'MEDIUM', 'GENERAL_BACKLOG', 4]));
    expect(notifications.notifyProjectAudience).toHaveBeenCalledWith(
      PROJECT_ID,
      OWNER_ID,
      expect.objectContaining({ type: 'TASK_CREATED', entityId: 'task-1' }),
    );
  });

  it('validates that the assignee participates in the project', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: PROJECT_ID }]);
    members.ensureParticipant.mockRejectedValueOnce(new ForbiddenException('El usuario no participa en el proyecto.'));

    await expect(
      service.create(OWNER_ID, PROJECT_ID, { title: 'Login', assignedTo: 'outsider' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(members.ensureParticipant).toHaveBeenCalledWith(PROJECT_ID, 'outsider');
  });

  it('refuses to send a task to the board when no sprint is active', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: PROJECT_ID }]).mockResolvedValueOnce([]);

    await expect(
      service.create(OWNER_ID, PROJECT_ID, { title: 'Login', section: 'SPRINT_BOARD' } as never),
    ).rejects.toThrow('No hay un sprint activo para enviar tickets al tablero.');
  });
});
