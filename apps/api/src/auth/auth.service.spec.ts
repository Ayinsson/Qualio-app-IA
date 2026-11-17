import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { asPrisma, createPrismaMock, PrismaMock, valuesOf } from '../test-utils/prisma-mock';
import { AuthService } from './auth.service';

const PAYLOAD = { sub: 'user-1', email: 'old@qualio.test' };

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'current@qualio.test',
    passwordHash: 'hash',
    name: 'Ana',
    avatarUrl: null,
    isActive: true,
    emailVerified: false,
    ...overrides,
  };
}

describe('AuthService.getSessionUser', () => {
  let prisma: PrismaMock;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AuthService(asPrisma(prisma), {} as JwtService);
  });

  it('returns the current user data when the user still exists and is active', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([userRow()]);

    await expect(service.getSessionUser(PAYLOAD)).resolves.toEqual({
      sub: 'user-1',
      email: 'current@qualio.test',
    });
    expect(valuesOf(prisma.$queryRaw.mock.calls[0])).toEqual(['user-1']);
  });

  it('rejects a validly signed token whose user no longer exists', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.getSessionUser(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose user was deactivated', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([userRow({ isActive: false })]);

    await expect(service.getSessionUser(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.updateAvatar', () => {
  let prisma: PrismaMock;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AuthService(asPrisma(prisma), {} as JwtService);
  });

  it('clears the photo when asked to remove it', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([userRow({ avatarUrl: 'https://cdn/avatar.png' })])
      .mockResolvedValueOnce([userRow({ avatarUrl: null })]);
    prisma.$executeRaw.mockResolvedValueOnce(1);

    const result = await service.updateAvatar('user-1', null);

    expect(valuesOf(prisma.$executeRaw.mock.calls[0])).toEqual([null, 'user-1']);
    expect(result.user.avatarUrl).toBeNull();
  });
});
