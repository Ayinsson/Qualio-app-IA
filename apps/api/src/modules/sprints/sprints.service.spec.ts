import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, sqlOf, valuesOf } from '../../test-utils/prisma-mock';
import { SprintEntity, SprintsService } from './sprints.service';

const OWNER_ID = 'owner-1';
const PROJECT_ID = 'project-1';

function sprint(overrides: Partial<SprintEntity> = {}): SprintEntity {
  return {
    id: 'sprint-new',
    projectId: PROJECT_ID,
    sequence: 1,
    name: 'Sprint 1',
    status: 'ACTIVE',
    startedAt: new Date('2026-01-01'),
    closedAt: null,
    createdBy: OWNER_ID,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('SprintsService.start', () => {
  let prisma: PrismaMock;
  let service: SprintsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new SprintsService(asPrisma(prisma));
  });

  it('rejects users who are not the project owner', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.start(OWNER_ID, PROJECT_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks starting a sprint when Proximo Sprint is empty', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: PROJECT_ID }]).mockResolvedValueOnce([{ count: 0 }]);

    await expect(service.start(OWNER_ID, PROJECT_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates Sprint 1 and moves Proximo Sprint items to the board when no sprint is active', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: PROJECT_ID }])
      .mockResolvedValueOnce([{ count: 3 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ lastSequence: 0 }])
      .mockResolvedValueOnce([sprint()]);

    const created = await service.start(OWNER_ID, PROJECT_ID);

    expect(created.name).toBe('Sprint 1');
    expect(valuesOf(prisma.$queryRaw.mock.calls[4])).toEqual(expect.arrayContaining([1, 'Sprint 1']));
    const updates = prisma.$executeRaw.mock.calls.map(sqlOf);
    expect(updates).toHaveLength(2);
    expect(updates.every((sql) => sql.includes("section = 'SPRINT_BOARD'") && sql.includes("section = 'NEXT_SPRINT'"))).toBe(true);
  });

  it('closes the active sprint and rolls unfinished items into the next one', async () => {
    const active = sprint({ id: 'sprint-3', sequence: 3, name: 'Sprint 3' });
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: PROJECT_ID }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([{ lastSequence: 3 }])
      .mockResolvedValueOnce([sprint({ sequence: 4, name: 'Sprint 4' })]);

    const created = await service.start(OWNER_ID, PROJECT_ID);

    expect(created.name).toBe('Sprint 4');
    const calls = prisma.$executeRaw.mock.calls;
    expect(calls).toHaveLength(5);
    expect(sqlOf(calls[0])).toContain("SET status = 'CLOSED'");
    expect(valuesOf(calls[0])).toEqual(['sprint-3']);
    expect(sqlOf(calls[1])).toContain('rollover_from_sprint_id = COALESCE');
    expect(sqlOf(calls[1])).toContain("status <> 'DONE'");
    expect(sqlOf(calls[2])).toContain("status NOT IN ('RESOLVED', 'CLOSED')");
  });
});
