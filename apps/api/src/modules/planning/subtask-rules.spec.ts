import { BadRequestException } from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, sqlOf, valuesOf } from '../../test-utils/prisma-mock';
import {
  assertNoOpenSubtasks,
  assertStageGroupInProject,
  assertValidParent,
  isFinishedStatus,
  resolvePlanningOnCreate,
  resolvePlanningOnUpdate,
} from './subtask-rules';

describe('subtask rules', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('knows which statuses are finished for each ticket type', () => {
    expect(isFinishedStatus('TASK', 'DONE')).toBe(true);
    expect(isFinishedStatus('TASK', 'IN_PROGRESS')).toBe(false);
    expect(isFinishedStatus('BUG', 'RESOLVED')).toBe(true);
    expect(isFinishedStatus('BUG', 'CLOSED')).toBe(true);
    expect(isFinishedStatus('BUG', 'OPEN')).toBe(false);
  });

  describe('assertNoOpenSubtasks', () => {
    it('lets the parent close when every subtask is closed', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(assertNoOpenSubtasks(asPrisma(prisma), 'TASK', 't1')).resolves.toBeUndefined();
      expect(valuesOf(prisma.$queryRaw.mock.calls[0])).toEqual(['TASK', 't1', 'TASK', 't1']);
    });

    it('blocks closing and names the open subtasks', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ itemKey: 'RYA-021' }, { itemKey: 'RYA-022' }]);
      await expect(assertNoOpenSubtasks(asPrisma(prisma), 'BUG', 'b1')).rejects.toThrow(
        'No se puede cerrar: faltan 2 subtareas por cerrar (RYA-021, RYA-022).',
      );
    });
  });

  describe('assertValidParent', () => {
    const base = { projectId: 'p1', parentType: 'TASK' as const, parentId: 't1' };

    it('accepts a top-level parent from the same project', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 't1', itemKey: 'RYA-020', parentId: null, stageGroupId: 'g1' }])
        .mockResolvedValueOnce([{ count: 0 }]);

      await expect(assertValidParent(asPrisma(prisma), { ...base, child: { type: 'BUG', id: 'b9' } })).resolves.toMatchObject({
        stageGroupId: 'g1',
      });
      expect(sqlOf(prisma.$queryRaw.mock.calls[0])).toContain('FROM tasks');
      expect(valuesOf(prisma.$queryRaw.mock.calls[0])).toEqual(['t1', 'p1']);
    });

    it('rejects a parent from another project, a parent that is already a subtask, and self-links', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(assertValidParent(asPrisma(prisma), base)).rejects.toThrow('no existe en este proyecto');

      prisma.$queryRaw.mockResolvedValueOnce([{ id: 't1', itemKey: 'RYA-020', parentId: 't0', stageGroupId: null }]);
      await expect(assertValidParent(asPrisma(prisma), base)).rejects.toThrow('solo se permite un nivel');

      await expect(assertValidParent(asPrisma(prisma), { ...base, child: { type: 'TASK', id: 't1' } })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects turning a ticket that has subtasks into a subtask', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 't1', itemKey: 'RYA-020', parentId: null, stageGroupId: null }])
        .mockResolvedValueOnce([{ count: 2 }]);
      await expect(assertValidParent(asPrisma(prisma), { ...base, child: { type: 'TASK', id: 't5' } })).rejects.toThrow(
        'tiene subtareas',
      );
    });
  });

  it('only accepts a macroactividad from the same project', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(assertStageGroupInProject(asPrisma(prisma), 'p1', 'g-otro')).rejects.toThrow('no existe en este proyecto');

    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'g1' }]);
    await expect(assertStageGroupInProject(asPrisma(prisma), 'p1', 'g1')).resolves.toBeUndefined();
  });
});

describe('planning links on create and update', () => {
  let prisma: PrismaMock;
  const none = { stageGroupId: null, parentType: null, parentId: null };

  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('creates a planned ticket, a subtask, or rejects mixing both', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'g1' }]);
    await expect(resolvePlanningOnCreate(asPrisma(prisma), 'p1', { stageGroupId: 'g1' })).resolves.toEqual({
      stageGroupId: 'g1',
      parentType: null,
      parentId: null,
    });

    prisma.$queryRaw.mockResolvedValueOnce([{ id: 't1', itemKey: 'RYA-020', parentId: null, stageGroupId: 'g1' }]);
    await expect(
      resolvePlanningOnCreate(asPrisma(prisma), 'p1', { parentType: 'TASK', parentId: 't1' }),
    ).resolves.toEqual({ stageGroupId: null, parentType: 'TASK', parentId: 't1' });

    await expect(
      resolvePlanningOnCreate(asPrisma(prisma), 'p1', { stageGroupId: 'g1', parentType: 'TASK', parentId: 't1' }),
    ).rejects.toThrow('hereda la etapa');
    await expect(resolvePlanningOnCreate(asPrisma(prisma), 'p1', { parentId: 't1' })).rejects.toThrow('tipo y el id');
  });

  it('marks the stage as changed when moving a ticket into, out of, or between macroactividades', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'g2' }]);
    const moved = await resolvePlanningOnUpdate(asPrisma(prisma), {
      projectId: 'p1',
      type: 'TASK',
      id: 't5',
      current: { ...none, stageGroupId: 'g1' },
      changes: { stageGroupId: 'g2' },
    });
    expect(moved).toMatchObject({ stageGroupId: 'g2', stageChanged: true });

    const untouched = await resolvePlanningOnUpdate(asPrisma(prisma), {
      projectId: 'p1',
      type: 'TASK',
      id: 't5',
      current: { ...none, stageGroupId: 'g1' },
      changes: {},
    });
    expect(untouched).toMatchObject({ stageGroupId: 'g1', stageChanged: false });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('drops its own macroactividad when a ticket becomes a subtask, and rejects giving it one', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 't1', itemKey: 'RYA-020', parentId: null, stageGroupId: 'g1' }])
      .mockResolvedValueOnce([{ count: 0 }]);
    const linked = await resolvePlanningOnUpdate(asPrisma(prisma), {
      projectId: 'p1',
      type: 'BUG',
      id: 'b5',
      current: { ...none, stageGroupId: 'g3' },
      changes: { parentType: 'TASK', parentId: 't1' },
    });
    expect(linked).toEqual({ stageGroupId: null, parentType: 'TASK', parentId: 't1', stageChanged: true });

    await expect(
      resolvePlanningOnUpdate(asPrisma(prisma), {
        projectId: 'p1',
        type: 'BUG',
        id: 'b5',
        current: { stageGroupId: null, parentType: 'TASK', parentId: 't1' },
        changes: { stageGroupId: 'g1' },
      }),
    ).rejects.toThrow('hereda la etapa');
  });
});
