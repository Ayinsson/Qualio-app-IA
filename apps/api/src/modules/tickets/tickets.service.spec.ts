import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { asPrisma, createPrismaMock, PrismaMock } from '../../test-utils/prisma-mock';
import { TicketsService } from './tickets.service';

/** Convierte la llamada a $queryRaw (con fragmentos Prisma.sql anidados) en SQL + valores. */
function compiled(call: unknown[]): { sql: string; values: unknown[] } {
  const query = Prisma.sql(call[0] as TemplateStringsArray, ...(call.slice(1) as unknown[]));
  return { sql: query.sql, values: query.values };
}

describe('TicketsService', () => {
  let prisma: PrismaMock;
  let service: TicketsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.$queryRaw.mockResolvedValue([]);
    service = new TicketsService(asPrisma(prisma));
  });

  it('defaults to open tickets of active projects owned by the user', async () => {
    await service.list('user-1', {});
    const { sql, values } = compiled(prisma.$queryRaw.mock.calls[0]);

    expect(sql).toContain('x."isOpen"');
    expect(sql).toContain(`x."projectStatus" = 'ACTIVE'`);
    expect(sql).toContain('p.owner_id = ?');
    expect(values).toEqual(['user-1', 'user-1', 50]);
  });

  it('combines overdue, type, assignee, priority and search filters', async () => {
    await service.list('user-1', {
      status: 'all',
      overdue: 'true',
      type: 'bug',
      assignedToMe: 'true',
      projectId: 'p1',
      priority: 'HIGH',
      q: ' QA-12 ',
      limit: 10,
    });
    const { sql, values } = compiled(prisma.$queryRaw.mock.calls[0]);

    expect(sql).toContain(`x."dueDate" < date_trunc('day', NOW())`);
    expect(sql).not.toContain('projectStatus" = ');
    expect(values).toEqual(['user-1', 'user-1', 'BUG', 'user-1', 'p1', 'HIGH', '%QA-12%', '%QA-12%', 10]);
  });

  it('finds a ticket by key ignoring case, or explains it was not found', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ itemKey: 'QA-12' }]);
    await expect(service.findByKey('user-1', ' qa-12 ')).resolves.toEqual({ itemKey: 'QA-12' });
    expect(compiled(prisma.$queryRaw.mock.calls[0]).values).toContain('qa-12');

    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.findByKey('user-1', 'QA-99')).rejects.toBeInstanceOf(NotFoundException);
  });
});
