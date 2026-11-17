import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { asPrisma, createPrismaMock, PrismaMock, valuesOf } from '../../test-utils/prisma-mock';
import { ProjectEntity, ProjectsService } from './projects.service';

const OWNER_ID = 'owner-1';

function project(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return {
    id: 'project-1',
    name: 'Qualio Web',
    logoUrl: null,
    description: null,
    projectType: 'WEB',
    ownerId: OWNER_ID,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('ProjectsService', () => {
  let prisma: PrismaMock;
  let service: ProjectsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ProjectsService(asPrisma(prisma));
  });

  describe('create', () => {
    it('creates an active project owned by the session user with a trimmed name', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: OWNER_ID }]).mockResolvedValueOnce([project()]);

      const created = await service.create(OWNER_ID, { name: '  Qualio Web  ', projectType: 'WEB' } as never);

      expect(created.ownerId).toBe(OWNER_ID);
      const insertValues = valuesOf(prisma.$queryRaw.mock.calls[1]);
      expect(insertValues).toContain('Qualio Web');
      expect(insertValues).toContain(OWNER_ID);
    });

    it('rejects the request when the session user no longer exists', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.create(OWNER_ID, { name: 'Qualio', projectType: 'WEB' } as never)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns a safe error when the insert fails', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: OWNER_ID }]).mockRejectedValueOnce(new Error('relation missing'));

      await expect(service.create(OWNER_ID, { name: 'Qualio', projectType: 'WEB' } as never)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('returns the project to its owner', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([project()]);

      await expect(service.findOne(OWNER_ID, 'project-1')).resolves.toMatchObject({ id: 'project-1' });
    });

    it('throws NotFound when the project does not exist', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.findOne(OWNER_ID, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when the user is not the owner', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([project({ ownerId: 'someone-else' })]);

      await expect(service.findOne(OWNER_ID, 'project-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update and archive', () => {
    it('keeps the current name when the payload does not include one', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([project()]).mockResolvedValueOnce([project({ logoUrl: 'logo.png' })]);

      await service.update(OWNER_ID, 'project-1', { logoUrl: 'logo.png' });

      expect(valuesOf(prisma.$queryRaw.mock.calls[1])).toEqual(['Qualio Web', 'logo.png', 'ACTIVE', 'project-1']);
    });

    it('archives a project by setting its status to ARCHIVED', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([project()]).mockResolvedValueOnce([project({ status: 'ARCHIVED' })]);

      const archived = await service.archive(OWNER_ID, 'project-1');

      expect(archived.status).toBe('ARCHIVED');
      expect(valuesOf(prisma.$queryRaw.mock.calls[1])).toContain('ARCHIVED');
    });

    it('does not let a non-owner archive the project', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([project({ ownerId: 'someone-else' })]);

      await expect(service.archive(OWNER_ID, 'project-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
