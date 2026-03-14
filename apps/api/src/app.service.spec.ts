import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

const prismaMock = {
  checkConnection: jest.fn(),
} as unknown as PrismaService;

describe('AppService', () => {
  it('returns health payload', () => {
    const service = new AppService(prismaMock);

    expect(service.getHealth()).toEqual({
      status: 'ok',
      service: 'qualio-api',
    });
  });

  it('returns mysql status ok when db is connected', async () => {
    const service = new AppService(prismaMock);
    jest.spyOn(prismaMock, 'checkConnection').mockResolvedValue(true);

    await expect(service.getDatabaseHealth()).resolves.toEqual({
      status: 'ok',
      database: 'mysql',
    });
  });
});
