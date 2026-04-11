import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';

export type SprintEntity = {
  id: string;
  projectId: string;
  sequence: number;
  name: string;
  status: 'ACTIVE' | 'CLOSED';
  startedAt: Date;
  closedAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(ownerId: string, projectId: string): Promise<SprintEntity | null> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const rows = await this.prisma.$queryRaw<SprintEntity[]>`
      SELECT
        id,
        project_id AS "projectId",
        sequence,
        name,
        status,
        started_at AS "startedAt",
        closed_at AS "closedAt",
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM sprints
      WHERE project_id = ${projectId}
        AND status = 'ACTIVE'
      ORDER BY sequence DESC
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async list(ownerId: string, projectId: string): Promise<SprintEntity[]> {
    await this.ensureProjectOwnership(projectId, ownerId);

    return this.prisma.$queryRaw<SprintEntity[]>`
      SELECT
        id,
        project_id AS "projectId",
        sequence,
        name,
        status,
        started_at AS "startedAt",
        closed_at AS "closedAt",
        created_by AS "createdBy",
        created_at AS "createdAt"
      FROM sprints
      WHERE project_id = ${projectId}
      ORDER BY sequence DESC
    `;
  }

  async start(ownerId: string, projectId: string): Promise<SprintEntity> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const nextSprintCandidates = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT (
        COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = ${projectId} AND section = 'NEXT_SPRINT'), 0) +
        COALESCE((SELECT COUNT(*) FROM bugs WHERE project_id = ${projectId} AND section = 'NEXT_SPRINT'), 0)
      )::int AS count
    `;

    const nextSprintCount = nextSprintCandidates[0]?.count ?? 0;
    if (nextSprintCount <= 0) {
      throw new BadRequestException('No puedes iniciar un sprint sin tickets en Proximo Sprint.');
    }

    return this.prisma.$transaction(async (tx) => {
      const activeRows = await tx.$queryRaw<SprintEntity[]>`
        SELECT
          id,
          project_id AS "projectId",
          sequence,
          name,
          status,
          started_at AS "startedAt",
          closed_at AS "closedAt",
          created_by AS "createdBy",
          created_at AS "createdAt"
        FROM sprints
        WHERE project_id = ${projectId}
          AND status = 'ACTIVE'
        ORDER BY sequence DESC
        LIMIT 1
      `;

      const activeSprint = activeRows[0] ?? null;

      const sequenceRows = await tx.$queryRaw<Array<{ lastSequence: number }>>`
        SELECT COALESCE(MAX(sequence), 0)::int AS "lastSequence"
        FROM sprints
        WHERE project_id = ${projectId}
      `;

      const nextSequence = (sequenceRows[0]?.lastSequence ?? 0) + 1;
      const newSprintId = randomUUID();

      const createdSprintRows = await tx.$queryRaw<SprintEntity[]>`
        INSERT INTO sprints (
          id,
          project_id,
          sequence,
          name,
          status,
          started_at,
          closed_at,
          created_by,
          created_at
        )
        VALUES (
          ${newSprintId},
          ${projectId},
          ${nextSequence},
          ${`Sprint ${nextSequence}`},
          'ACTIVE',
          NOW(),
          NULL,
          ${ownerId},
          NOW()
        )
        RETURNING
          id,
          project_id AS "projectId",
          sequence,
          name,
          status,
          started_at AS "startedAt",
          closed_at AS "closedAt",
          created_by AS "createdBy",
          created_at AS "createdAt"
      `;

      if (activeSprint) {
        await tx.$executeRaw`
          UPDATE sprints
          SET status = 'CLOSED',
              closed_at = NOW()
          WHERE id = ${activeSprint.id}
        `;

        await tx.$executeRaw`
          UPDATE tasks
          SET sprint_id = ${newSprintId},
              rollover_from_sprint_id = COALESCE(rollover_from_sprint_id, sprint_id),
              updated_by = ${ownerId},
              updated_at = NOW()
          WHERE project_id = ${projectId}
            AND section = 'SPRINT_BOARD'
            AND status <> 'DONE'
        `;

        await tx.$executeRaw`
          UPDATE bugs
          SET sprint_id = ${newSprintId},
              rollover_from_sprint_id = COALESCE(rollover_from_sprint_id, sprint_id),
              updated_by = ${ownerId},
              updated_at = NOW()
          WHERE project_id = ${projectId}
            AND section = 'SPRINT_BOARD'
            AND status NOT IN ('RESOLVED', 'CLOSED')
        `;
      }

      await tx.$executeRaw`
        UPDATE tasks
        SET section = 'SPRINT_BOARD',
            sprint_id = ${newSprintId},
            rollover_from_sprint_id = NULL,
            updated_by = ${ownerId},
            updated_at = NOW()
        WHERE project_id = ${projectId}
          AND section = 'NEXT_SPRINT'
      `;

      await tx.$executeRaw`
        UPDATE bugs
        SET section = 'SPRINT_BOARD',
            sprint_id = ${newSprintId},
            rollover_from_sprint_id = NULL,
            updated_by = ${ownerId},
            updated_at = NOW()
        WHERE project_id = ${projectId}
          AND section = 'NEXT_SPRINT'
      `;

      return createdSprintRows[0];
    });
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
      throw new ForbiddenException('Solo el owner puede iniciar sprint en este proyecto.');
    }
  }
}
