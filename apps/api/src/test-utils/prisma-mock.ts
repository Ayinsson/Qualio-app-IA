import { PrismaService } from '../prisma/prisma.service';

export type PrismaMock = {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  $transaction: jest.Mock;
};

/**
 * Prisma mock for services that use tagged-template raw queries.
 * Queue results with `$queryRaw.mockResolvedValueOnce(...)` in call order.
 * `$transaction` runs its callback against the same mock.
 */
export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((callback: (tx: PrismaMock) => unknown) => callback(mock));
  return mock;
}

export function asPrisma(mock: PrismaMock): PrismaService {
  return mock as unknown as PrismaService;
}

/** Returns the SQL text of a tagged-template call, joining its string parts. */
export function sqlOf(call: unknown[]): string {
  return (call[0] as string[]).join('?');
}

/** Returns the interpolated values of a tagged-template call. */
export function valuesOf(call: unknown[]): unknown[] {
  return call.slice(1);
}
