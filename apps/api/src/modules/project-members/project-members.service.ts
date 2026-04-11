import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

export type ProjectMemberEntity = {
  projectId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string, projectId: string): Promise<ProjectMemberEntity[]> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const ownerRows = await this.prisma.$queryRaw<ProjectMemberEntity[]>`
      SELECT
        p.id AS "projectId",
        u.id AS "userId",
        'OWNER' AS role,
        u.name,
        u.email,
        u.avatar_url AS "avatarUrl"
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      WHERE p.id = ${projectId}
      LIMIT 1
    `;

    const memberRows = await this.prisma.$queryRaw<ProjectMemberEntity[]>`
      SELECT
        pm.project_id AS "projectId",
        u.id AS "userId",
        pm.role,
        u.name,
        u.email,
        u.avatar_url AS "avatarUrl"
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ${projectId}
      ORDER BY pm.created_at ASC
    `;

    return [...ownerRows, ...memberRows];
  }

  async add(ownerId: string, projectId: string, dto: AddProjectMemberDto): Promise<ProjectMemberEntity[]> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const userRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM users
      WHERE email = ${dto.email.toLowerCase().trim()}
      LIMIT 1
    `;

    const userId = userRows[0]?.id;
    if (!userId) {
      throw new NotFoundException('No existe un usuario con ese correo.');
    }

    const ownerRows = await this.prisma.$queryRaw<Array<{ ownerId: string }>>`
      SELECT owner_id AS "ownerId"
      FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `;

    if (ownerRows.length === 0) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    if (ownerRows[0].ownerId === userId) {
      throw new BadRequestException('El usuario ya es propietario del proyecto.');
    }

    await this.prisma.$executeRaw`
      INSERT INTO project_members (id, project_id, user_id, role, created_at)
      VALUES (${randomUUID()}, ${projectId}, ${userId}, ${dto.role ?? 'MEMBER'}, NOW())
      ON CONFLICT (project_id, user_id)
      DO UPDATE SET role = EXCLUDED.role
    `;

    return this.list(ownerId, projectId);
  }

  async remove(ownerId: string, projectId: string, userId: string): Promise<{ success: true }> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const ownerRows = await this.prisma.$queryRaw<Array<{ ownerId: string }>>`
      SELECT owner_id AS "ownerId"
      FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `;

    if (ownerRows.length === 0) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    if (ownerRows[0].ownerId === userId) {
      throw new BadRequestException('No se puede remover al propietario del proyecto.');
    }

    await this.prisma.$executeRaw`
      DELETE FROM project_members
      WHERE project_id = ${projectId}
        AND user_id = ${userId}
    `;

    return { success: true };
  }

  async ensureParticipant(projectId: string, userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM projects p
      WHERE p.id = ${projectId}
        AND (
          p.owner_id = ${userId}
          OR EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = ${userId}
          )
        )
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new BadRequestException('El usuario asignado no pertenece al proyecto.');
    }
  }

  private async ensureProjectOwnership(projectId: string, ownerId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM projects
      WHERE id = ${projectId}
        AND owner_id = ${ownerId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new ForbiddenException('No tienes permiso para administrar miembros en este proyecto.');
    }
  }
}
