import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';

export type TicketSummary = {
  type: 'TASK' | 'BUG';
  id: string;
  itemKey: string | null;
  title: string;
  status: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  section: string;
  dueDate: Date | null;
  isOpen: boolean;
  isOverdue: boolean;
  assignedTo: string | null;
  assignedToName: string | null;
  projectId: string;
  projectName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TicketDetail = TicketSummary & {
  description: string | null;
  environment: string | null;
  expectedResult: string | null;
  actualResult: string | null;
};

const DEFAULT_LIMIT = 50;

/**
 * Vista unificada de tareas y bugs de todos los proyectos del usuario,
 * pensada para agentes: "mis tickets abiertos", "lo vencido", "busca QA-12".
 * Sigue la misma regla de acceso que tareas y bugs: solo proyectos propios.
 */
@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, query: ListTicketsQueryDto): Promise<TicketSummary[]> {
    const conditions: Prisma.Sql[] = [];
    const status = query.status ?? 'open';

    if (status === 'open') {
      conditions.push(Prisma.sql`x."isOpen"`);
    } else if (status === 'closed') {
      conditions.push(Prisma.sql`NOT x."isOpen"`);
    }
    if (query.type) {
      conditions.push(Prisma.sql`x."type" = ${query.type.toUpperCase()}`);
    }
    if (query.overdue === 'true') {
      conditions.push(Prisma.sql`x."isOpen" AND x."dueDate" < date_trunc('day', NOW())`);
    }
    if (query.assignedToMe === 'true') {
      conditions.push(Prisma.sql`x."assignedTo" = ${userId}`);
    }
    if (query.projectId) {
      conditions.push(Prisma.sql`x."projectId" = ${query.projectId}`);
    } else {
      conditions.push(Prisma.sql`x."projectStatus" = 'ACTIVE'`);
    }
    if (query.priority) {
      conditions.push(Prisma.sql`x.priority = ${query.priority}`);
    }
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim()}%`;
      conditions.push(Prisma.sql`(x.title ILIKE ${pattern} OR x."itemKey" ILIKE ${pattern})`);
    }

    const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    return this.prisma.$queryRaw<TicketSummary[]>`
      SELECT ${this.summaryColumns()}
      FROM (${this.unifiedTickets(userId)}) x
      ${where}
      ORDER BY x."dueDate" IS NULL, x."dueDate" ASC, x."updatedAt" DESC
      LIMIT ${query.limit ?? DEFAULT_LIMIT}
    `;
  }

  async findByKey(userId: string, itemKey: string): Promise<TicketDetail> {
    const rows = await this.prisma.$queryRaw<TicketDetail[]>`
      SELECT
        ${this.summaryColumns()},
        x.description,
        x.environment,
        x."expectedResult",
        x."actualResult"
      FROM (${this.unifiedTickets(userId)}) x
      WHERE UPPER(x."itemKey") = UPPER(${itemKey.trim()})
      LIMIT 1
    `;

    if (!rows[0]) {
      throw new NotFoundException(`No encontramos el ticket ${itemKey} en tus proyectos.`);
    }

    return rows[0];
  }

  private summaryColumns(): Prisma.Sql {
    return Prisma.sql`
      x."type",
      x.id,
      x."itemKey",
      x.title,
      x.status,
      x.priority,
      x.section,
      x."dueDate",
      x."isOpen",
      (x."isOpen" AND x."dueDate" IS NOT NULL AND x."dueDate" < date_trunc('day', NOW())) AS "isOverdue",
      x."assignedTo",
      x."assignedToName",
      x."projectId",
      x."projectName",
      x."createdAt",
      x."updatedAt"
    `;
  }

  private unifiedTickets(userId: string): Prisma.Sql {
    return Prisma.sql`
      SELECT
        'TASK' AS "type",
        t.id,
        t.item_key AS "itemKey",
        t.title,
        t.status,
        t.priority,
        t.section,
        t.due_date AS "dueDate",
        t.status <> 'DONE' AS "isOpen",
        t.assigned_to AS "assignedTo",
        au.name AS "assignedToName",
        t.project_id AS "projectId",
        p.name AS "projectName",
        p.status AS "projectStatus",
        t.description,
        NULL::VARCHAR AS environment,
        NULL::TEXT AS "expectedResult",
        NULL::TEXT AS "actualResult",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users au ON au.id = t.assigned_to
      WHERE p.owner_id = ${userId}
      UNION ALL
      SELECT
        'BUG' AS "type",
        b.id,
        b.item_key AS "itemKey",
        b.title,
        b.status,
        b.priority,
        b.section,
        b.due_date AS "dueDate",
        b.status IN ('OPEN', 'IN_PROGRESS') AS "isOpen",
        NULL::VARCHAR AS "assignedTo",
        NULL::VARCHAR AS "assignedToName",
        b.project_id AS "projectId",
        p.name AS "projectName",
        p.status AS "projectStatus",
        b.description,
        b.environment,
        b.expected_result AS "expectedResult",
        b.actual_result AS "actualResult",
        b.created_at AS "createdAt",
        b.updated_at AS "updatedAt"
      FROM bugs b
      JOIN projects p ON p.id = b.project_id
      WHERE p.owner_id = ${userId}
    `;
  }
}
