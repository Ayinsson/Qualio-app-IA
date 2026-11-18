import { ForbiddenException } from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, sqlOf, valuesOf } from '../../test-utils/prisma-mock';
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
      .mockResolvedValueOnce([{ code: 'QUA' }])
      .mockResolvedValueOnce([{ nextValue: 7 }])
      .mockResolvedValueOnce([{ id: 'task-1', itemKey: 'QUA-007' }]);

    const created = await service.create(OWNER_ID, PROJECT_ID, { title: '  Login  ' } as never);

    expect(created.itemKey).toBe('QUA-007');
    expect(sqlOf(prisma.$queryRaw.mock.calls[2])).toContain('qualio_project_code(name, id)');
    const insertValues = valuesOf(prisma.$queryRaw.mock.calls[4]);
    expect(insertValues).toEqual(expect.arrayContaining(['QUA-007', 'Login', 'MEDIUM', 'GENERAL_BACKLOG', 4]));
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

describe('TasksService with planning', () => {
  let prisma: PrismaMock;
  let service: TasksService;

  const current = {
    id: 'task-1',
    itemKey: 'RYA-020',
    projectId: PROJECT_ID,
    title: 'Hacer el assessment',
    description: null,
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    section: 'GENERAL_BACKLOG',
    position: 0,
    assignedTo: null,
    dueDate: null,
    startDate: null,
    stageGroupId: 'g1',
    parentType: null,
    parentId: null,
    sprintId: null,
    completedInSprintId: null,
    rolloverFromSprintId: null,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new TasksService(
      asPrisma(prisma),
      { ensureParticipant: jest.fn() } as unknown as ProjectMembersService,
      { notifyProjectAudience: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService,
    );
  });

  it('does not close a task while it has open subtasks', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([current])
      .mockResolvedValueOnce([{ id: PROJECT_ID }])
      .mockResolvedValueOnce([{ itemKey: 'RYA-021' }]);

    await expect(service.update(OWNER_ID, 'task-1', { status: 'DONE' } as never)).rejects.toThrow(
      'No se puede cerrar: falta 1 subtarea por cerrar (RYA-021).',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a macroactividad from another project when creating a task', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: PROJECT_ID }]).mockResolvedValueOnce([{ nextPosition: 0 }]).mockResolvedValueOnce([]);

    await expect(
      service.create(OWNER_ID, PROJECT_ID, { title: 'Login', stageGroupId: 'g-otro' } as never),
    ).rejects.toThrow('La macroactividad no existe en este proyecto.');
  });

  it('stores the start date, the macroactividad and when it was planned', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: PROJECT_ID }])
      .mockResolvedValueOnce([{ nextPosition: 2 }])
      .mockResolvedValueOnce([{ id: 'g1' }])
      .mockResolvedValueOnce([{ code: 'RYA' }])
      .mockResolvedValueOnce([{ nextValue: 30 }])
      .mockResolvedValueOnce([{ id: 'task-9', itemKey: 'RYA-030' }]);

    await service.create(OWNER_ID, PROJECT_ID, { title: 'Validar', startDate: '2026-11-09', stageGroupId: 'g1' } as never);

    const insert = prisma.$queryRaw.mock.calls[5];
    expect(sqlOf(insert)).toContain('stage_group_id');
    const values = valuesOf(insert);
    expect(values).toEqual(expect.arrayContaining(['g1', new Date('2026-11-09')]));
    expect(values.filter((value) => value instanceof Date)).toHaveLength(2);
  });
});
