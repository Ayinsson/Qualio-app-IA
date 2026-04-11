import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectSummaryDto } from './dto/project-summary.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

export type ProjectEntity = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  projectType: string | null;
  ownerId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto): Promise<ProjectEntity> {
    await this.ensureOwnerExists(ownerId);

    try {
      const project = await this.prisma.$queryRaw<ProjectEntity[]>`
        INSERT INTO projects (id, name, logo_url, description, project_type, owner_id, status, created_at, updated_at)
        VALUES (${randomUUID()}, ${dto.name.trim()}, ${dto.logoUrl ?? null}, ${dto.description?.trim() ?? null}, ${dto.projectType}, ${ownerId}, 'ACTIVE', NOW(), NOW())
        RETURNING
          id,
          name,
          logo_url AS "logoUrl",
          description,
          project_type AS "projectType",
          owner_id AS "ownerId",
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;

      return project[0];
    } catch {
      throw new InternalServerErrorException(
        'No fue posible crear el proyecto. Verifica la estructura de la base de datos.',
      );
    }
  }

  async findAll(ownerId: string, status?: 'ACTIVE' | 'ARCHIVED'): Promise<ProjectEntity[]> {
    await this.ensureOwnerExists(ownerId);

    if (status) {
      return this.prisma.$queryRaw<ProjectEntity[]>`
        SELECT
          id,
          name,
          logo_url AS "logoUrl",
          description,
          project_type AS "projectType",
          owner_id AS "ownerId",
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM projects
        WHERE owner_id = ${ownerId}
          AND status = ${status}
        ORDER BY created_at DESC
      `;
    }

    return this.prisma.$queryRaw<ProjectEntity[]>`
      SELECT
        id,
        name,
        logo_url AS "logoUrl",
        description,
        project_type AS "projectType",
        owner_id AS "ownerId",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM projects
      WHERE owner_id = ${ownerId}
      ORDER BY created_at DESC
    `;
  }

  private async ensureOwnerExists(ownerId: string): Promise<void> {
    const users = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM users
      WHERE id = ${ownerId}
      LIMIT 1
    `;

    if (users.length === 0) {
      throw new UnauthorizedException('Sesion invalida. Inicia sesion nuevamente.');
    }
  }

  async findOne(ownerId: string, id: string): Promise<ProjectEntity> {
    const project = await this.findById(id);
    this.ensureOwnership(project, ownerId);
    return project;
  }

  async update(ownerId: string, id: string, dto: UpdateProjectDto): Promise<ProjectEntity> {
    const project = await this.findById(id);
    this.ensureOwnership(project, ownerId);

    const nextName = dto.name?.trim() ?? project.name;
    const nextLogo = dto.logoUrl === undefined ? project.logoUrl : dto.logoUrl;
    const nextStatus = dto.status ?? project.status;

    const updated = await this.prisma.$queryRaw<ProjectEntity[]>`
      UPDATE projects
      SET
        name = ${nextName},
        logo_url = ${nextLogo},
        status = ${nextStatus},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        name,
        logo_url AS "logoUrl",
        description,
        project_type AS "projectType",
        owner_id AS "ownerId",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    return updated[0];
  }

  async archive(ownerId: string, id: string): Promise<ProjectEntity> {
    return this.update(ownerId, id, { status: 'ARCHIVED' });
  }

  async summary(ownerId: string, id: string): Promise<ProjectSummaryDto> {
    const project = await this.findById(id);
    this.ensureOwnership(project, ownerId);

    return {
      projectId: id,
      totalTasks: 0,
      completedTasks: 0,
      totalTestCases: 0,
      totalBugs: 0,
      openBugs: 0,
    };
  }

  private async findById(id: string): Promise<ProjectEntity> {
    const projects = await this.prisma.$queryRaw<ProjectEntity[]>`
      SELECT
        id,
        name,
        logo_url AS "logoUrl",
        description,
        project_type AS "projectType",
        owner_id AS "ownerId",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM projects
      WHERE id = ${id}
      LIMIT 1
    `;

    const project = projects[0];

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private ensureOwnership(project: ProjectEntity, ownerId: string): void {
    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('No tienes permiso para este proyecto.');
    }
  }
}
