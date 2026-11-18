import { BadRequestException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, sqlOf, valuesOf } from '../../test-utils/prisma-mock';
import { ApiTokensService, hashApiToken } from './api-tokens.service';

function authRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'token-1',
    userId: 'user-1',
    email: 'ana@qualio.test',
    isActive: true,
    scopes: ['tickets:read'],
    expiresAt: null,
    lastUsedAt: new Date(),
    revokedAt: null,
    ...overrides,
  };
}

describe('ApiTokensService', () => {
  let prisma: PrismaMock;
  let service: ApiTokensService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ApiTokensService(asPrisma(prisma));
  });

  describe('create', () => {
    it('returns the full token once and stores only its hash and visible prefix', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ activeCount: 0 }]);
      prisma.$queryRaw.mockImplementationOnce(() => Promise.resolve([{ id: 'token-1' }]));

      const result = await service.create('user-1', { name: ' Mi agente ', scopes: ['tickets:read'] });

      expect(result.token).toMatch(/^qlo_[A-Za-z0-9_-]{43}$/);
      const values = valuesOf(prisma.$queryRaw.mock.calls[1]);
      expect(values).toContain('Mi agente');
      expect(values).toContain(result.token.slice(0, 12));
      expect(values).toContain(hashApiToken(result.token));
      expect(values).not.toContain(result.token);
    });

    it('defaults to a 90 day expiration and supports tokens without expiration', async () => {
      prisma.$queryRaw.mockResolvedValue([{ activeCount: 0 }]);

      await service.create('user-1', { name: 'Por defecto', scopes: ['tickets:read'] });
      const expiresAt = valuesOf(prisma.$queryRaw.mock.calls[1])[6] as Date;
      const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(89.9);
      expect(days).toBeLessThanOrEqual(90);

      await service.create('user-1', { name: 'Sin vencimiento', scopes: ['tickets:read'], expiration: 'never' });
      expect(valuesOf(prisma.$queryRaw.mock.calls[3])[6]).toBeNull();
    });

    it('rejects creating more than 20 active tokens', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ activeCount: 20 }]);

      await expect(service.create('user-1', { name: 'Otro', scopes: ['tickets:read'] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('revoke', () => {
    it('only revokes tokens owned by the user', async () => {
      prisma.$executeRaw.mockResolvedValueOnce(1);

      await expect(service.revoke('user-1', 'token-1')).resolves.toEqual({ success: true });
      expect(valuesOf(prisma.$executeRaw.mock.calls[0])).toEqual(['token-1', 'user-1']);
    });

    it('fails when the token does not exist, belongs to someone else or was already revoked', async () => {
      prisma.$executeRaw.mockResolvedValueOnce(0);

      await expect(service.revoke('user-1', 'token-x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('authenticate', () => {
    it('looks the token up by hash and returns the owner identity with its scopes', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([authRow()]);

      await expect(service.authenticate('qlo_abc')).resolves.toEqual({
        sub: 'user-1',
        email: 'ana@qualio.test',
        authType: 'api_token',
        tokenId: 'token-1',
        scopes: ['tickets:read'],
      });
      expect(valuesOf(prisma.$queryRaw.mock.calls[0])).toEqual([hashApiToken('qlo_abc')]);
    });

    it.each([
      ['unknown', null],
      ['revoked', authRow({ revokedAt: new Date() })],
      ['expired', authRow({ expiresAt: new Date(Date.now() - 1000) })],
      ['owned by an inactive user', authRow({ isActive: false })],
    ])('rejects a token that is %s', async (_label, row) => {
      prisma.$queryRaw.mockResolvedValueOnce(row ? [row] : []);

      await expect(service.authenticate('qlo_abc')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refreshes last_used_at at most once per minute', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([authRow({ lastUsedAt: new Date(Date.now() - 120_000) })]);
      await service.authenticate('qlo_abc');
      expect(sqlOf(prisma.$executeRaw.mock.calls[0])).toContain('last_used_at = NOW()');

      prisma.$executeRaw.mockClear();
      prisma.$queryRaw.mockResolvedValueOnce([authRow({ lastUsedAt: new Date() })]);
      await service.authenticate('qlo_abc');
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('returns 429 after 120 requests in the same minute', async () => {
      prisma.$queryRaw.mockResolvedValue([authRow()]);

      for (let i = 0; i < 120; i += 1) {
        await service.authenticate('qlo_abc');
      }

      await expect(service.authenticate('qlo_abc')).rejects.toMatchObject({ status: 429 });
      await expect(service.authenticate('qlo_abc')).rejects.toBeInstanceOf(HttpException);
    });
  });
});
