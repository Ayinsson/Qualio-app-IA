import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, sqlOf, valuesOf } from '../../test-utils/prisma-mock';
import { buildPlanningView, PlanningService, type StageGroupRecord, type StageRecord } from './planning.service';

const STAGE: StageRecord = {
  id: 's1',
  projectId: 'p1',
  position: 0,
  code: 'I1',
  name: 'Análisis y diseño',
  ownerName: 'Delia',
  startDate: '2026-11-02',
  endDate: '2026-11-13',
  deliverables: null,
  exitCriteria: null,
  createdOn: '2026-10-28',
};

const GROUP: StageGroupRecord = {
  id: 'g1',
  stageId: 's1',
  projectId: 'p1',
  position: 0,
  name: 'Plan y dependencias',
  ownerName: null,
  startDate: '2026-11-02',
  endDate: '2026-11-13',
};

function ticket(overrides: Record<string, unknown>) {
  return {
    type: 'TASK',
    id: 't0',
    itemKey: 'RYA-000',
    title: 'Ticket',
    status: 'TODO',
    priority: 'MEDIUM',
    startDate: null,
    dueDate: null,
    assignedTo: null,
    assigneeName: null,
    stageGroupId: 'g1',
    plannedOn: '2026-10-30',
    parentType: null,
    parentId: null,
    ...overrides,
  } as never;
}

describe('buildPlanningView', () => {
  it('builds the stage tree with partial credit from subtasks, baseline and unplanned tickets', () => {
    const view = buildPlanningView({
      today: '2026-11-06',
      stages: [STAGE],
      groups: [GROUP],
      tickets: [
        ticket({ id: 't1', itemKey: 'RYA-001', status: 'DONE' }),
        ticket({ id: 't2', itemKey: 'RYA-002' }),
        // Subtareas de t2: una cerrada (bug resuelto) y otra abierta. No suman alcance.
        ticket({ type: 'BUG', id: 'b1', itemKey: 'RYA-003', status: 'RESOLVED', stageGroupId: null, parentType: 'TASK', parentId: 't2' }),
        ticket({ id: 't3', itemKey: 'RYA-004', stageGroupId: null, parentType: 'TASK', parentId: 't2' }),
        // Agregado después del inicio de la etapa.
        ticket({ id: 't4', itemKey: 'RYA-005', plannedOn: '2026-11-04' }),
        // Sin planificar.
        ticket({ id: 't5', itemKey: 'RYA-006', stageGroupId: null, plannedOn: null }),
      ],
    });

    const [stage] = view.stages;
    expect(stage.stats.total).toBe(3);
    expect(stage.stats.done).toBe(1.5);
    expect(stage.stats.actualPct).toBe(50);
    expect(stage.stats.committed).toBe(2);
    expect(stage.stats.added).toBe(1);

    const tickets = stage.groups[0].tickets;
    expect(tickets.map((item) => item.itemKey)).toEqual(['RYA-001', 'RYA-002', 'RYA-005']);
    expect(tickets[1].subtasks).toEqual({ done: 1, total: 2 });
    expect(tickets[2].addedAfterStart).toBe(true);
    expect(tickets[0]).not.toHaveProperty('plannedOn');

    expect(view.unplannedTickets.map((item) => item.itemKey)).toEqual(['RYA-006']);
    expect(view.project.plannedEnd).toBe('2026-11-13');
  });

  it('takes the creation day as the baseline when the plan is built with the stage already running', () => {
    const view = buildPlanningView({
      today: '2026-11-18',
      stages: [{ ...STAGE, createdOn: '2026-11-18' }],
      groups: [GROUP],
      tickets: [
        ticket({ id: 't1', plannedOn: '2026-11-18' }),
        ticket({ id: 't2', plannedOn: '2026-11-19' }),
      ],
    });
    expect(view.stages[0].stats.committed).toBe(1);
    expect(view.stages[0].stats.added).toBe(1);
    expect(view.stages[0].groups[0].tickets.map((item) => item.addedAfterStart)).toEqual([false, true]);
  });

  it('returns an empty plan for a project without stages', () => {
    const view = buildPlanningView({ today: '2026-11-06', stages: [], groups: [], tickets: [ticket({ stageGroupId: null })] });
    expect(view.stages).toEqual([]);
    expect(view.project).toEqual({ overallPct: null, plannedEnd: null, forecastEnd: null, slipDays: 0 });
    expect(view.unplannedTickets).toHaveLength(1);
  });
});

describe('PlanningService', () => {
  let prisma: PrismaMock;
  let service: PlanningService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PlanningService(asPrisma(prisma));
  });

  it('only lets the project owner read or change the plan', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.getPlanning('intruso', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates a stage at the end of the list with trimmed values', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'p1' }]).mockResolvedValueOnce([STAGE]);

    await service.createStage('u1', 'p1', {
      code: ' I1 ',
      name: ' Análisis y diseño ',
      ownerName: '  ',
      startDate: '2026-11-02',
      endDate: '2026-11-13',
    });

    const insert = prisma.$queryRaw.mock.calls[1];
    expect(sqlOf(insert)).toContain('COALESCE(MAX(position), -1) + 1');
    expect(valuesOf(insert)).toEqual(expect.arrayContaining(['I1', 'Análisis y diseño', null, '2026-11-02', '2026-11-13']));
  });

  it('rejects an end date before the start date', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: 'p1' }]);
    await expect(
      service.createStage('u1', 'p1', { name: 'X', startDate: '2026-11-13', endDate: '2026-11-02' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.$queryRaw.mockResolvedValueOnce([GROUP]).mockResolvedValueOnce([{ id: 'p1' }]);
    await expect(service.updateGroup('u1', 'g1', { endDate: '2026-10-01' })).rejects.toThrow('anterior a la de inicio');
  });

  it('moves a stage up by swapping positions with its neighbor', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ ...STAGE, id: 's2', position: 1 }])
      .mockResolvedValueOnce([{ id: 'p1' }])
      .mockResolvedValueOnce([{ id: 's1', position: 0 }])
      .mockResolvedValueOnce([{ ...STAGE, id: 's2', position: 0 }]);

    await service.updateStage('u1', 's2', { move: 'up' });

    const swaps = prisma.$executeRaw.mock.calls.map((call) => valuesOf(call));
    expect(swaps).toEqual([
      [1, 's1'],
      [0, 's2'],
    ]);
  });

  it('deletes a macroactividad without deleting its tickets', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([GROUP]).mockResolvedValueOnce([{ id: 'p1' }]);
    await service.deleteGroup('u1', 'g1');

    expect(sqlOf(prisma.$executeRaw.mock.calls[0])).toContain('DELETE FROM project_stage_groups');
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
