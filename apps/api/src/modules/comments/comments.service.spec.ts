import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { requestContextMiddleware, setRequestApiTokenId } from '../../common/request-context';
import { asPrisma, createPrismaMock, PrismaMock, sqlOf, valuesOf } from '../../test-utils/prisma-mock';
import { CommentsService } from './comments.service';

const OWNED = [{ projectId: 'p1', ownerId: 'user-1' }];

describe('CommentsService', () => {
  let prisma: PrismaMock;
  let service: CommentsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CommentsService(asPrisma(prisma));
  });

  it('stores a trimmed comment without token when it comes from the web', async () => {
    prisma.$queryRaw.mockResolvedValueOnce(OWNED).mockResolvedValueOnce([{ id: 'c1' }]);

    await expect(service.create('user-1', 'TASK', 't1', { body: '  Listo para QA  ' })).resolves.toEqual({ id: 'c1' });

    const insert = prisma.$executeRaw.mock.calls[0];
    expect(sqlOf(insert)).toContain('INSERT INTO work_item_comments');
    expect(valuesOf(insert)).toEqual([expect.any(String), 'TASK', 't1', 'p1', 'user-1', null, 'Listo para QA']);
  });

  it('records the API token that wrote the comment', async () => {
    prisma.$queryRaw.mockResolvedValueOnce(OWNED).mockResolvedValueOnce([{ id: 'c1' }]);

    await new Promise<void>((resolve, reject) => {
      requestContextMiddleware(null, null, () => {
        setRequestApiTokenId('token-9');
        service.create('user-1', 'BUG', 'b1', { body: 'Cerrado por el agente' }).then(() => resolve(), reject);
      });
    });

    expect(valuesOf(prisma.$executeRaw.mock.calls[0])[5]).toBe('token-9');
    expect(sqlOf(prisma.$queryRaw.mock.calls[0])).toContain('FROM bugs b');
  });

  it('rejects empty comments before touching the database', async () => {
    await expect(service.create('user-1', 'TASK', 't1', { body: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown ticket and 403 for someone else’s project', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(service.list('user-1', 'TASK', 'nope')).rejects.toBeInstanceOf(NotFoundException);

    prisma.$queryRaw.mockResolvedValueOnce([{ projectId: 'p2', ownerId: 'other' }]);
    await expect(service.list('user-1', 'TASK', 't2')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
