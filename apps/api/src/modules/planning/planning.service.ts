import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateStageDto,
  CreateStageGroupDto,
  type MoveDirection,
  UpdateStageDto,
  UpdateStageGroupDto,
} from './dto/planning.dto';
import {
  computeProgress,
  computeProjectStats,
  type DateOnly,
  type ProgressStats,
  type ProgressUnit,
  type ProjectStats,
  ticketCredit,
  todayIn,
} from './planning-stats';
import { isFinishedStatus, type WorkItemType } from './subtask-rules';

export type StageRecord = {
  id: string;
  projectId: string;
  position: number;
  code: string | null;
  name: string;
  ownerName: string | null;
  startDate: DateOnly;
  endDate: DateOnly;
  deliverables: string | null;
  exitCriteria: string | null;
  /** Día en que se creó la etapa en Qualio. */
  createdOn: DateOnly;
};

export type StageGroupRecord = {
  id: string;
  stageId: string;
  projectId: string;
  position: number;
  name: string;
  ownerName: string | null;
  startDate: DateOnly;
  endDate: DateOnly;
};

type TicketRow = {
  type: WorkItemType;
  id: string;
  itemKey: string | null;
  title: string;
  status: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  startDate: Date | null;
  dueDate: Date | null;
  assignedTo: string | null;
  assigneeName: string | null;
  stageGroupId: string | null;
  plannedOn: DateOnly | null;
  parentType: WorkItemType | null;
  parentId: string | null;
};

export type PlanTicket = Omit<TicketRow, 'plannedOn'> & {
  isDone: boolean;
  subtasks: { done: number; total: number };
  /** Entró a la etapa después de su fecha de inicio (alcance agregado). */
  addedAfterStart: boolean;
};

export type PlanGroup = StageGroupRecord & { stats: ProgressStats; tickets: PlanTicket[] };
export type PlanStage = StageRecord & { stats: ProgressStats; groups: PlanGroup[] };

export type PlanningView = {
  today: DateOnly;
  project: ProjectStats;
  stages: PlanStage[];
  /** Tickets de primer nivel sin macroactividad (no cuentan para ninguna etapa). */
  unplannedTickets: PlanTicket[];
};

const STAGE_COLUMNS = Prisma.sql`
  id,
  project_id AS "projectId",
  position,
  code,
  name,
  owner_name AS "ownerName",
  to_char(start_date, 'YYYY-MM-DD') AS "startDate",
  to_char(end_date, 'YYYY-MM-DD') AS "endDate",
  deliverables,
  exit_criteria AS "exitCriteria",
  to_char(created_at, 'YYYY-MM-DD') AS "createdOn"
`;

const GROUP_COLUMNS = Prisma.sql`
  id,
  stage_id AS "stageId",
  project_id AS "projectId",
  position,
  name,
  owner_name AS "ownerName",
  to_char(start_date, 'YYYY-MM-DD') AS "startDate",
  to_char(end_date, 'YYYY-MM-DD') AS "endDate"
`;

const TIME_ZONE = process.env.PLANNING_TIMEZONE || 'America/Bogota';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlanning(userId: string, projectId: string, today: DateOnly = todayIn(TIME_ZONE)): Promise<PlanningView> {
    await this.ensureProjectOwnership(projectId, userId);

    const stages = await this.prisma.$queryRaw<StageRecord[]>`
      SELECT ${STAGE_COLUMNS}
      FROM project_stages
      WHERE project_id = ${projectId}
      ORDER BY position, start_date, created_at
    `;
    const groups = await this.prisma.$queryRaw<StageGroupRecord[]>`
      SELECT ${GROUP_COLUMNS}
      FROM project_stage_groups
      WHERE project_id = ${projectId}
      ORDER BY position, start_date, created_at
    `;
    const tickets = await this.prisma.$queryRaw<TicketRow[]>`
      SELECT 'TASK' AS "type", t.id, t.item_key AS "itemKey", t.title, t.status, t.priority,
        t.start_date AS "startDate", t.due_date AS "dueDate", t.assigned_to AS "assignedTo",
        COALESCE(NULLIF(u.name, ''), u.email) AS "assigneeName",
        t.stage_group_id AS "stageGroupId", to_char(t.planned_at, 'YYYY-MM-DD') AS "plannedOn",
        t.parent_entity_type AS "parentType", t.parent_entity_id AS "parentId"
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = ${projectId}
      UNION ALL
      SELECT 'BUG' AS "type", b.id, b.item_key AS "itemKey", b.title, b.status, b.priority,
        b.start_date AS "startDate", b.due_date AS "dueDate", NULL AS "assignedTo", NULL AS "assigneeName",
        b.stage_group_id AS "stageGroupId", to_char(b.planned_at, 'YYYY-MM-DD') AS "plannedOn",
        b.parent_entity_type AS "parentType", b.parent_entity_id AS "parentId"
      FROM bugs b
      WHERE b.project_id = ${projectId}
      ORDER BY "itemKey"
    `;

    return buildPlanningView({ today, stages, groups, tickets });
  }

  async createStage(userId: string, projectId: string, dto: CreateStageDto): Promise<StageRecord> {
    await this.ensureProjectOwnership(projectId, userId);
    assertDateRange(dto.startDate, dto.endDate);

    const rows = await this.prisma.$queryRaw<StageRecord[]>`
      INSERT INTO project_stages (
        id, project_id, position, code, name, owner_name, start_date, end_date, deliverables, exit_criteria, created_at, updated_at
      )
      VALUES (
        ${randomUUID()},
        ${projectId},
        (SELECT COALESCE(MAX(position), -1) + 1 FROM project_stages WHERE project_id = ${projectId}),
        ${clean(dto.code)},
        ${dto.name.trim()},
        ${clean(dto.ownerName)},
        ${dto.startDate}::date,
        ${dto.endDate}::date,
        ${clean(dto.deliverables)},
        ${clean(dto.exitCriteria)},
        NOW(),
        NOW()
      )
      RETURNING ${STAGE_COLUMNS}
    `;
    return rows[0];
  }

  async updateStage(userId: string, stageId: string, dto: UpdateStageDto): Promise<StageRecord> {
    const current = await this.findStage(stageId);
    await this.ensureProjectOwnership(current.projectId, userId);

    const startDate = dto.startDate ?? current.startDate;
    const endDate = dto.endDate ?? current.endDate;
    assertDateRange(startDate, endDate);

    if (dto.move) {
      await this.swapPosition('project_stages', current, dto.move);
    }

    const rows = await this.prisma.$queryRaw<StageRecord[]>`
      UPDATE project_stages
      SET
        code = ${dto.code === undefined ? current.code : clean(dto.code)},
        name = ${dto.name?.trim() ?? current.name},
        owner_name = ${dto.ownerName === undefined ? current.ownerName : clean(dto.ownerName)},
        start_date = ${startDate}::date,
        end_date = ${endDate}::date,
        deliverables = ${dto.deliverables === undefined ? current.deliverables : clean(dto.deliverables)},
        exit_criteria = ${dto.exitCriteria === undefined ? current.exitCriteria : clean(dto.exitCriteria)},
        updated_at = NOW()
      WHERE id = ${stageId}
      RETURNING ${STAGE_COLUMNS}
    `;
    return rows[0];
  }

  /** Borra la etapa y sus macroactividades. Los tickets quedan "sin planificar". */
  async deleteStage(userId: string, stageId: string): Promise<{ success: true }> {
    const current = await this.findStage(stageId);
    await this.ensureProjectOwnership(current.projectId, userId);
    await this.prisma.$executeRaw`DELETE FROM project_stages WHERE id = ${stageId}`;
    return { success: true };
  }

  async createGroup(userId: string, stageId: string, dto: CreateStageGroupDto): Promise<StageGroupRecord> {
    const stage = await this.findStage(stageId);
    await this.ensureProjectOwnership(stage.projectId, userId);
    assertDateRange(dto.startDate, dto.endDate);

    const rows = await this.prisma.$queryRaw<StageGroupRecord[]>`
      INSERT INTO project_stage_groups (
        id, stage_id, project_id, position, name, owner_name, start_date, end_date, created_at, updated_at
      )
      VALUES (
        ${randomUUID()},
        ${stageId},
        ${stage.projectId},
        (SELECT COALESCE(MAX(position), -1) + 1 FROM project_stage_groups WHERE stage_id = ${stageId}),
        ${dto.name.trim()},
        ${clean(dto.ownerName)},
        ${dto.startDate}::date,
        ${dto.endDate}::date,
        NOW(),
        NOW()
      )
      RETURNING ${GROUP_COLUMNS}
    `;
    return rows[0];
  }

  async updateGroup(userId: string, groupId: string, dto: UpdateStageGroupDto): Promise<StageGroupRecord> {
    const current = await this.findGroup(groupId);
    await this.ensureProjectOwnership(current.projectId, userId);

    const startDate = dto.startDate ?? current.startDate;
    const endDate = dto.endDate ?? current.endDate;
    assertDateRange(startDate, endDate);

    if (dto.move) {
      await this.swapPosition('project_stage_groups', current, dto.move);
    }

    const rows = await this.prisma.$queryRaw<StageGroupRecord[]>`
      UPDATE project_stage_groups
      SET
        name = ${dto.name?.trim() ?? current.name},
        owner_name = ${dto.ownerName === undefined ? current.ownerName : clean(dto.ownerName)},
        start_date = ${startDate}::date,
        end_date = ${endDate}::date,
        updated_at = NOW()
      WHERE id = ${groupId}
      RETURNING ${GROUP_COLUMNS}
    `;
    return rows[0];
  }

  /** Borra la macroactividad. Sus tickets quedan "sin planificar". */
  async deleteGroup(userId: string, groupId: string): Promise<{ success: true }> {
    const current = await this.findGroup(groupId);
    await this.ensureProjectOwnership(current.projectId, userId);
    await this.prisma.$executeRaw`DELETE FROM project_stage_groups WHERE id = ${groupId}`;
    return { success: true };
  }

  private async findStage(stageId: string): Promise<StageRecord> {
    const rows = await this.prisma.$queryRaw<StageRecord[]>`
      SELECT ${STAGE_COLUMNS} FROM project_stages WHERE id = ${stageId} LIMIT 1
    `;
    if (!rows[0]) {
      throw new NotFoundException('Etapa no encontrada.');
    }
    return rows[0];
  }

  private async findGroup(groupId: string): Promise<StageGroupRecord> {
    const rows = await this.prisma.$queryRaw<StageGroupRecord[]>`
      SELECT ${GROUP_COLUMNS} FROM project_stage_groups WHERE id = ${groupId} LIMIT 1
    `;
    if (!rows[0]) {
      throw new NotFoundException('Macroactividad no encontrada.');
    }
    return rows[0];
  }

  /** Intercambia la posición con la etapa/macroactividad vecina (arriba o abajo). */
  private async swapPosition(
    table: 'project_stages' | 'project_stage_groups',
    current: { id: string; position: number; projectId: string; stageId?: string },
    direction: MoveDirection,
  ): Promise<void> {
    const neighbors =
      table === 'project_stages'
        ? await this.prisma.$queryRaw<Array<{ id: string; position: number }>>`
            SELECT id, position FROM project_stages
            WHERE project_id = ${current.projectId} AND id <> ${current.id}
            ORDER BY position, start_date, created_at
          `
        : await this.prisma.$queryRaw<Array<{ id: string; position: number }>>`
            SELECT id, position FROM project_stage_groups
            WHERE stage_id = ${current.stageId ?? ''} AND id <> ${current.id}
            ORDER BY position, start_date, created_at
          `;

    const neighbor =
      direction === 'up'
        ? [...neighbors].reverse().find((item) => item.position <= current.position)
        : neighbors.find((item) => item.position >= current.position);
    if (!neighbor) {
      return;
    }

    const [targetForCurrent, targetForNeighbor] =
      neighbor.position === current.position
        ? direction === 'up'
          ? [current.position - 1, current.position]
          : [current.position + 1, current.position]
        : [neighbor.position, current.position];

    await this.prisma.$transaction(async (tx) => {
      if (table === 'project_stages') {
        await tx.$executeRaw`UPDATE project_stages SET position = ${targetForNeighbor} WHERE id = ${neighbor.id}`;
        await tx.$executeRaw`UPDATE project_stages SET position = ${targetForCurrent} WHERE id = ${current.id}`;
      } else {
        await tx.$executeRaw`UPDATE project_stage_groups SET position = ${targetForNeighbor} WHERE id = ${neighbor.id}`;
        await tx.$executeRaw`UPDATE project_stage_groups SET position = ${targetForCurrent} WHERE id = ${current.id}`;
      }
    });
    current.position = targetForCurrent;
  }

  private async ensureProjectOwnership(projectId: string, userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM projects WHERE id = ${projectId} AND owner_id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) {
      throw new ForbiddenException('No tienes permiso para este proyecto.');
    }
  }
}

/**
 * Corte de la línea base de una etapa: su inicio o, si el plan se armó con la etapa ya
 * en curso, el día en que se creó (lo asignado ese día también cuenta como comprometido).
 */
export function baselineOf(stage: Pick<StageRecord, 'startDate' | 'createdOn'>): DateOnly {
  return stage.createdOn > stage.startDate ? stage.createdOn : stage.startDate;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertDateRange(startDate: DateOnly, endDate: DateOnly): void {
  if (endDate < startDate) {
    throw new BadRequestException('La fecha de fin no puede ser anterior a la de inicio.');
  }
}

/** Arma el árbol Etapa → Macroactividad → Tickets con sus estadísticas. Sin base de datos. */
export function buildPlanningView(input: {
  today: DateOnly;
  stages: StageRecord[];
  groups: StageGroupRecord[];
  tickets: TicketRow[];
}): PlanningView {
  const { today, stages, groups, tickets } = input;

  const childrenOf = new Map<string, TicketRow[]>();
  for (const ticket of tickets) {
    if (ticket.parentId && ticket.parentType) {
      const key = `${ticket.parentType}:${ticket.parentId}`;
      childrenOf.set(key, [...(childrenOf.get(key) ?? []), ticket]);
    }
  }

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const groupById = new Map(groups.map((group) => [group.id, group]));

  // Crédito y día de planificación de cada ticket, para el cálculo (no se devuelven al cliente).
  const unitById = new Map<string, ProgressUnit>();

  const toPlanTicket = (row: TicketRow): PlanTicket => {
    const children = childrenOf.get(`${row.type}:${row.id}`) ?? [];
    const childrenDone = children.filter((child) => isFinishedStatus(child.type, child.status)).length;
    const isDone = isFinishedStatus(row.type, row.status);
    const group = row.stageGroupId ? groupById.get(row.stageGroupId) : undefined;
    const stage = group ? stageById.get(group.stageId) : undefined;
    const { plannedOn, ...rest } = row;
    unitById.set(`${row.type}:${row.id}`, { credit: ticketCredit(isDone, childrenDone, children.length), plannedOn });
    return {
      ...rest,
      isDone,
      subtasks: { done: childrenDone, total: children.length },
      addedAfterStart: Boolean(stage && plannedOn && plannedOn > baselineOf(stage)),
    };
  };

  const topLevel = tickets.filter((ticket) => !ticket.parentId).map(toPlanTicket);
  const unitsOf = (list: PlanTicket[]): ProgressUnit[] =>
    list.map((ticket) => unitById.get(`${ticket.type}:${ticket.id}`) as ProgressUnit);

  const planStages: PlanStage[] = stages.map((stage) => {
    const stageGroups = groups.filter((group) => group.stageId === stage.id);
    const planGroups: PlanGroup[] = stageGroups.map((group) => {
      const groupTickets = topLevel.filter((ticket) => ticket.stageGroupId === group.id);
      return {
        ...group,
        stats: computeProgress({
          startDate: group.startDate,
          endDate: group.endDate,
          today,
          units: unitsOf(groupTickets),
          baselineDate: baselineOf(stage),
        }),
        tickets: groupTickets,
      };
    });
    const stageTickets = topLevel.filter((ticket) => stageGroups.some((group) => group.id === ticket.stageGroupId));
    return {
      ...stage,
      stats: computeProgress({
        startDate: stage.startDate,
        endDate: stage.endDate,
        today,
        units: unitsOf(stageTickets),
        baselineDate: baselineOf(stage),
      }),
      groups: planGroups,
    };
  });

  return {
    today,
    project: computeProjectStats(planStages.map((stage) => ({ endDate: stage.endDate, stats: stage.stats }))),
    stages: planStages,
    unplannedTickets: topLevel.filter((ticket) => !ticket.stageGroupId || !groupById.has(ticket.stageGroupId))
  };
}
