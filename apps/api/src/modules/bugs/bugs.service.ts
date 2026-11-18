import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { currentApiTokenId } from '../../common/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  assertNoOpenSubtasks,
  isFinishedStatus,
  resolvePlanningOnCreate,
  resolvePlanningOnUpdate,
  type WorkItemType,
} from '../planning/subtask-rules';
import { type BacklogSection } from '../tasks/dto/create-task.dto';
import { CreateBugDto } from './dto/create-bug.dto';
import { MoveBugDto } from './dto/move-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';

export type BugEntity = {
  id: string;
  itemKey: string | null;
  projectId: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  section: 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
  position: number;
  environment: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  dueDate: Date | null;
  startDate: Date | null;
  /** Macroactividad del Planning; null en subtareas (heredan la del padre) o sin planificar. */
  stageGroupId: string | null;
  /** Si es subtarea: el ticket del que depende. */
  parentType: WorkItemType | null;
  parentId: string | null;
  sprintId: string | null;
  sprintName: string | null;
  sprintSequence: number | null;
  completedInSprintId: string | null;
  completedInSprintName: string | null;
  completedInSprintSequence: number | null;
  rolloverFromSprintId: string | null;
  rolloverFromSprintName: string | null;
  rolloverFromSprintSequence: number | null;
  reportedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BugHistoryEntry = {
  id: string;
  entityType: 'TASK' | 'BUG';
  entityId: string;
  projectId: string;
  changedBy: string;
  changedByName: string | null;
  changedByEmail: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeNote: string | null;
  /** Token de API con el que se hizo el cambio; null si fue desde la web. */
  apiTokenId: string | null;
  apiTokenName: string | null;
  createdAt: Date;
};

@Injectable()
export class BugsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(ownerId: string, projectId: string, dto: CreateBugDto): Promise<BugEntity> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const section = dto.section ?? 'GENERAL_BACKLOG';
    const sprintId = section === 'SPRINT_BOARD' ? await this.resolveActiveSprintId(projectId) : null;
    const nextPosition = await this.getNextPosition(projectId, section);
    const planning = await resolvePlanningOnCreate(this.prisma, projectId, {
      stageGroupId: dto.stageGroupId,
      parentType: dto.parentType,
      parentId: dto.parentId,
    });
    const projectCode = await this.getProjectCodePrefix(projectId);
    const nextSequence = await this.reserveNextSequence(projectId);
    const itemKey = `${projectCode}-${String(nextSequence).padStart(3, '0')}`;

    const rows = await this.prisma.$queryRaw<BugEntity[]>`
      INSERT INTO bugs (
        id,
        item_key,
        project_id,
        title,
        description,
        priority,
        status,
        section,
        position,
        environment,
        expected_result,
        actual_result,
        due_date,
        start_date,
        stage_group_id,
        planned_at,
        parent_entity_type,
        parent_entity_id,
        sprint_id,
        completed_in_sprint_id,
        rollover_from_sprint_id,
        reported_by,
        created_at,
        updated_at
      )
      VALUES (
        ${randomUUID()},
        ${itemKey},
        ${projectId},
        ${dto.title.trim()},
        ${dto.description.trim()},
        ${dto.priority ?? 'MEDIUM'},
        'OPEN',
        ${section},
        ${nextPosition},
        ${dto.environment?.trim() ?? null},
        ${dto.expectedResult?.trim() ?? null},
        ${dto.actualResult?.trim() ?? null},
        ${dto.dueDate ? new Date(dto.dueDate) : null},
        ${dto.startDate ? new Date(dto.startDate) : null},
        ${planning.stageGroupId},
        ${planning.stageGroupId ? new Date() : null},
        ${planning.parentType},
        ${planning.parentId},
        ${sprintId},
        NULL,
        NULL,
        ${ownerId},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        item_key AS "itemKey",
        project_id AS "projectId",
        title,
        description,
        priority,
        status,
        section,
        position,
        environment,
        expected_result AS "expectedResult",
        actual_result AS "actualResult",
        due_date AS "dueDate",
        start_date AS "startDate",
        stage_group_id AS "stageGroupId",
        parent_entity_type AS "parentType",
        parent_entity_id AS "parentId",
        sprint_id AS "sprintId",
        NULL::VARCHAR AS "sprintName",
        NULL::INT AS "sprintSequence",
        completed_in_sprint_id AS "completedInSprintId",
        NULL::VARCHAR AS "completedInSprintName",
        NULL::INT AS "completedInSprintSequence",
        rollover_from_sprint_id AS "rolloverFromSprintId",
        NULL::VARCHAR AS "rolloverFromSprintName",
        NULL::INT AS "rolloverFromSprintSequence",
        reported_by AS "reportedBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const created = rows[0];

    await this.notificationsService.notifyProjectAudience(projectId, ownerId, {
      type: 'BUG_CREATED',
      title: `Nuevo bug ${created.itemKey ?? created.id}`,
      message: `${dto.title.trim()} fue reportado en el proyecto.`,
      projectId,
      entityType: 'BUG',
      entityId: created.id,
    });

    return created;
  }

  async findAll(ownerId: string, projectId: string, section?: BacklogSection): Promise<BugEntity[]> {
    await this.ensureProjectOwnership(projectId, ownerId);

    if (section) {
      return this.prisma.$queryRaw<BugEntity[]>`
        SELECT
          b.id,
          b.item_key AS "itemKey",
          b.project_id AS "projectId",
          b.title,
          b.description,
          b.priority,
          b.status,
          b.section,
          b.position,
          b.environment,
          b.expected_result AS "expectedResult",
          b.actual_result AS "actualResult",
        b.due_date AS "dueDate",
        b.start_date AS "startDate",
        b.stage_group_id AS "stageGroupId",
        b.parent_entity_type AS "parentType",
        b.parent_entity_id AS "parentId",
          b.sprint_id AS "sprintId",
          s.name AS "sprintName",
          s.sequence AS "sprintSequence",
          b.completed_in_sprint_id AS "completedInSprintId",
          cs.name AS "completedInSprintName",
          cs.sequence AS "completedInSprintSequence",
          b.rollover_from_sprint_id AS "rolloverFromSprintId",
          rs.name AS "rolloverFromSprintName",
          rs.sequence AS "rolloverFromSprintSequence",
          b.reported_by AS "reportedBy",
          b.created_at AS "createdAt",
          b.updated_at AS "updatedAt"
        FROM bugs b
        LEFT JOIN sprints s ON s.id = b.sprint_id
        LEFT JOIN sprints cs ON cs.id = b.completed_in_sprint_id
        LEFT JOIN sprints rs ON rs.id = b.rollover_from_sprint_id
        WHERE b.project_id = ${projectId}
          AND b.section = ${section}
        ORDER BY b.section, b.position, b.created_at
      `;
    }

    return this.prisma.$queryRaw<BugEntity[]>`
      SELECT
        b.id,
        b.item_key AS "itemKey",
        b.project_id AS "projectId",
        b.title,
        b.description,
        b.priority,
        b.status,
        b.section,
        b.position,
        b.environment,
        b.expected_result AS "expectedResult",
        b.actual_result AS "actualResult",
        b.due_date AS "dueDate",
        b.start_date AS "startDate",
        b.stage_group_id AS "stageGroupId",
        b.parent_entity_type AS "parentType",
        b.parent_entity_id AS "parentId",
        b.sprint_id AS "sprintId",
        s.name AS "sprintName",
        s.sequence AS "sprintSequence",
        b.completed_in_sprint_id AS "completedInSprintId",
        cs.name AS "completedInSprintName",
        cs.sequence AS "completedInSprintSequence",
        b.rollover_from_sprint_id AS "rolloverFromSprintId",
        rs.name AS "rolloverFromSprintName",
        rs.sequence AS "rolloverFromSprintSequence",
        b.reported_by AS "reportedBy",
        b.created_at AS "createdAt",
        b.updated_at AS "updatedAt"
      FROM bugs b
      LEFT JOIN sprints s ON s.id = b.sprint_id
      LEFT JOIN sprints cs ON cs.id = b.completed_in_sprint_id
      LEFT JOIN sprints rs ON rs.id = b.rollover_from_sprint_id
      WHERE b.project_id = ${projectId}
      ORDER BY b.section, b.position, b.created_at
    `;
  }

  async move(ownerId: string, id: string, dto: MoveBugDto): Promise<BugEntity> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);
    const targetSprintId = dto.section === 'SPRINT_BOARD' ? await this.resolveActiveSprintId(current.projectId) : null;

    await this.prisma.$transaction(async (tx) => {
      if (current.section === dto.section) {
        if (dto.targetPosition > current.position) {
          await tx.$executeRaw`
            UPDATE bugs
            SET position = position - 1,
                updated_at = NOW()
            WHERE project_id = ${current.projectId}
              AND section = ${current.section}
              AND position > ${current.position}
              AND position <= ${dto.targetPosition}
          `;
        } else if (dto.targetPosition < current.position) {
          await tx.$executeRaw`
            UPDATE bugs
            SET position = position + 1,
                updated_at = NOW()
            WHERE project_id = ${current.projectId}
              AND section = ${current.section}
              AND position >= ${dto.targetPosition}
              AND position < ${current.position}
          `;
        }
      } else {
        await tx.$executeRaw`
          UPDATE bugs
          SET position = position - 1,
              updated_at = NOW()
          WHERE project_id = ${current.projectId}
            AND section = ${current.section}
            AND position > ${current.position}
        `;

        await tx.$executeRaw`
          UPDATE bugs
          SET position = position + 1,
              updated_at = NOW()
          WHERE project_id = ${current.projectId}
            AND section = ${dto.section}
            AND position >= ${dto.targetPosition}
        `;
      }

      await tx.$executeRaw`
        UPDATE bugs
        SET section = ${dto.section},
            position = ${dto.targetPosition},
            sprint_id = ${dto.section === 'SPRINT_BOARD' ? targetSprintId : null},
            completed_in_sprint_id = ${dto.section === 'SPRINT_BOARD' ? current.completedInSprintId : null},
            rollover_from_sprint_id = ${dto.section === 'SPRINT_BOARD' ? current.rolloverFromSprintId : null},
            updated_by = ${ownerId},
            updated_at = NOW()
        WHERE id = ${id}
      `;
    });

    const moved = await this.findById(id);

    await this.notificationsService.notifyProjectAudience(current.projectId, ownerId, {
      type: 'BUG_UPDATED',
      title: `Bug movido ${moved.itemKey ?? moved.id}`,
      message: `Se movió a ${dto.section}.`,
      projectId: current.projectId,
      entityType: 'BUG',
      entityId: id,
    });

    return moved;
  }

  async update(ownerId: string, id: string, dto: UpdateBugDto): Promise<BugEntity> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);

    const nextTitle = dto.title?.trim() ?? current.title;
    const nextDescription = dto.description?.trim() ?? current.description;
    const nextPriority = dto.priority ?? current.priority;
    const nextStatus = dto.status ?? current.status;
    const isReopen = (current.status === 'RESOLVED' || current.status === 'CLOSED') && !['RESOLVED', 'CLOSED'].includes(nextStatus);
    const nextSection = isReopen ? 'GENERAL_BACKLOG' : dto.section ?? current.section;
    const nextEnvironment = dto.environment === undefined ? current.environment : dto.environment.trim() || null;
    const nextExpected = dto.expectedResult === undefined ? current.expectedResult : dto.expectedResult.trim() || null;
    const nextActual = dto.actualResult === undefined ? current.actualResult : dto.actualResult.trim() || null;
    const nextDueDate = dto.dueDate === undefined ? current.dueDate : dto.dueDate === null ? null : new Date(dto.dueDate);
    const nextStartDate =
      dto.startDate === undefined ? current.startDate : dto.startDate === null ? null : new Date(dto.startDate);
    const planning = await resolvePlanningOnUpdate(this.prisma, {
      projectId: current.projectId,
      type: 'BUG',
      id,
      current: { stageGroupId: current.stageGroupId, parentType: current.parentType, parentId: current.parentId },
      changes: { stageGroupId: dto.stageGroupId, parentType: dto.parentType, parentId: dto.parentId },
    });
    // Una subtarea es una dependencia: el ticket no se cierra mientras tenga subtareas abiertas.
    if (isFinishedStatus('BUG', nextStatus) && !isFinishedStatus('BUG', current.status)) {
      await assertNoOpenSubtasks(this.prisma, 'BUG', id);
    }
    const isFinished = nextStatus === 'RESOLVED' || nextStatus === 'CLOSED';
    const nextSprintId = isReopen
      ? null
      : nextSection === 'SPRINT_BOARD'
        ? current.sprintId ?? (await this.resolveActiveSprintId(current.projectId))
        : null;
    const nextCompletedInSprintId =
      isReopen || !isFinished
        ? null
        : current.section === 'SPRINT_BOARD' && current.sprintId
          ? current.sprintId
          : current.completedInSprintId;
    const nextRolloverFromSprintId = isReopen ? null : current.rolloverFromSprintId;

    const changePairs = [
      { field: 'title', oldValue: current.title, newValue: nextTitle },
      { field: 'description', oldValue: current.description, newValue: nextDescription },
      { field: 'priority', oldValue: current.priority, newValue: nextPriority },
      { field: 'status', oldValue: current.status, newValue: nextStatus },
      { field: 'section', oldValue: current.section, newValue: nextSection },
      { field: 'sprint_id', oldValue: current.sprintId ?? null, newValue: nextSprintId ?? null },
      {
        field: 'completed_in_sprint_id',
        oldValue: current.completedInSprintId ?? null,
        newValue: nextCompletedInSprintId ?? null,
      },
      { field: 'environment', oldValue: current.environment ?? null, newValue: nextEnvironment },
      { field: 'expected_result', oldValue: current.expectedResult ?? null, newValue: nextExpected },
      { field: 'actual_result', oldValue: current.actualResult ?? null, newValue: nextActual },
      {
        field: 'due_date',
        oldValue: current.dueDate ? current.dueDate.toISOString() : null,
        newValue: nextDueDate ? nextDueDate.toISOString() : null,
      },
      {
        field: 'start_date',
        oldValue: current.startDate ? current.startDate.toISOString() : null,
        newValue: nextStartDate ? nextStartDate.toISOString() : null,
      },
      { field: 'stage_group_id', oldValue: current.stageGroupId ?? null, newValue: planning.stageGroupId },
      {
        field: 'parent',
        oldValue: current.parentId ? `${current.parentType}:${current.parentId}` : null,
        newValue: planning.parentId ? `${planning.parentType}:${planning.parentId}` : null,
      },
    ].filter((entry) => (entry.oldValue ?? null) !== (entry.newValue ?? null));

    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<BugEntity[]>`
        UPDATE bugs
        SET
          title = ${nextTitle},
          description = ${nextDescription},
          priority = ${nextPriority},
          status = ${nextStatus},
          section = ${nextSection},
          sprint_id = ${nextSprintId},
          completed_in_sprint_id = ${nextCompletedInSprintId},
          rollover_from_sprint_id = ${nextRolloverFromSprintId},
          environment = ${nextEnvironment},
          expected_result = ${nextExpected},
          actual_result = ${nextActual},
          due_date = ${nextDueDate},
          start_date = ${nextStartDate},
          stage_group_id = ${planning.stageGroupId},
          planned_at = CASE WHEN ${planning.stageChanged} THEN ${planning.stageGroupId ? new Date() : null}::timestamp ELSE planned_at END,
          parent_entity_type = ${planning.parentType},
          parent_entity_id = ${planning.parentId},
          updated_by = ${ownerId},
          last_change_note = ${dto.changeNote?.trim() || null},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING
          id,
          item_key AS "itemKey",
          project_id AS "projectId",
          title,
          description,
          priority,
          status,
          section,
          position,
          environment,
          expected_result AS "expectedResult",
          actual_result AS "actualResult",
          due_date AS "dueDate",
          start_date AS "startDate",
          stage_group_id AS "stageGroupId",
          parent_entity_type AS "parentType",
          parent_entity_id AS "parentId",
          sprint_id AS "sprintId",
          NULL::VARCHAR AS "sprintName",
          NULL::INT AS "sprintSequence",
          completed_in_sprint_id AS "completedInSprintId",
          NULL::VARCHAR AS "completedInSprintName",
          NULL::INT AS "completedInSprintSequence",
          rollover_from_sprint_id AS "rolloverFromSprintId",
          NULL::VARCHAR AS "rolloverFromSprintName",
          NULL::INT AS "rolloverFromSprintSequence",
          reported_by AS "reportedBy",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `;

      for (const entry of changePairs) {
        await tx.$executeRaw`
          INSERT INTO work_item_history (
            id,
            entity_type,
            entity_id,
            project_id,
            changed_by,
            field_name,
            old_value,
            new_value,
            change_note,
            api_token_id,
            created_at
          )
          VALUES (
            ${randomUUID()},
            'BUG',
            ${id},
            ${current.projectId},
            ${ownerId},
            ${entry.field},
            ${entry.oldValue},
            ${entry.newValue},
            ${dto.changeNote?.trim() || null},
            ${currentApiTokenId()},
            NOW()
          )
        `;
      }

      return rows[0];
    });

    await this.notificationsService.notifyProjectAudience(current.projectId, ownerId, {
      type: 'BUG_UPDATED',
      title: `Bug actualizado ${updated.itemKey ?? updated.id}`,
      message: dto.changeNote?.trim() || `${updated.title} recibio cambios.`,
      projectId: current.projectId,
      entityType: 'BUG',
      entityId: id,
    });

    return updated;
  }

  async history(ownerId: string, id: string): Promise<BugHistoryEntry[]> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);

    return this.prisma.$queryRaw<BugHistoryEntry[]>`
      SELECT
        h.id,
        h.entity_type AS "entityType",
        h.entity_id AS "entityId",
        h.project_id AS "projectId",
        h.changed_by AS "changedBy",
        u.name AS "changedByName",
        u.email AS "changedByEmail",
        h.field_name AS "fieldName",
        h.old_value AS "oldValue",
        h.new_value AS "newValue",
        h.change_note AS "changeNote",
        h.api_token_id AS "apiTokenId",
        t.name AS "apiTokenName",
        h.created_at AS "createdAt"
      FROM work_item_history h
      JOIN users u ON u.id = h.changed_by
      LEFT JOIN api_tokens t ON t.id = h.api_token_id
      WHERE h.entity_type = 'BUG'
        AND h.entity_id = ${id}
      ORDER BY h.created_at DESC
    `;
  }

  async reopen(ownerId: string, id: string): Promise<BugEntity> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);

    const updatedRows = await this.prisma.$queryRaw<BugEntity[]>`
      UPDATE bugs
      SET status = 'OPEN',
          section = 'GENERAL_BACKLOG',
          sprint_id = NULL,
          completed_in_sprint_id = NULL,
          rollover_from_sprint_id = NULL,
          updated_by = ${ownerId},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        item_key AS "itemKey",
        project_id AS "projectId",
        title,
        description,
        priority,
        status,
        section,
        position,
        environment,
        expected_result AS "expectedResult",
        actual_result AS "actualResult",
        due_date AS "dueDate",
        start_date AS "startDate",
        stage_group_id AS "stageGroupId",
        parent_entity_type AS "parentType",
        parent_entity_id AS "parentId",
        sprint_id AS "sprintId",
        NULL::VARCHAR AS "sprintName",
        NULL::INT AS "sprintSequence",
        completed_in_sprint_id AS "completedInSprintId",
        NULL::VARCHAR AS "completedInSprintName",
        NULL::INT AS "completedInSprintSequence",
        rollover_from_sprint_id AS "rolloverFromSprintId",
        NULL::VARCHAR AS "rolloverFromSprintName",
        NULL::INT AS "rolloverFromSprintSequence",
        reported_by AS "reportedBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    return updatedRows[0];
  }

  private async findById(id: string): Promise<BugEntity> {
    const rows = await this.prisma.$queryRaw<BugEntity[]>`
      SELECT
        b.id,
        b.item_key AS "itemKey",
        b.project_id AS "projectId",
        b.title,
        b.description,
        b.priority,
        b.status,
        b.section,
        b.position,
        b.environment,
        b.expected_result AS "expectedResult",
        b.actual_result AS "actualResult",
        b.due_date AS "dueDate",
        b.start_date AS "startDate",
        b.stage_group_id AS "stageGroupId",
        b.parent_entity_type AS "parentType",
        b.parent_entity_id AS "parentId",
        b.sprint_id AS "sprintId",
        s.name AS "sprintName",
        s.sequence AS "sprintSequence",
        b.completed_in_sprint_id AS "completedInSprintId",
        cs.name AS "completedInSprintName",
        cs.sequence AS "completedInSprintSequence",
        b.rollover_from_sprint_id AS "rolloverFromSprintId",
        rs.name AS "rolloverFromSprintName",
        rs.sequence AS "rolloverFromSprintSequence",
        b.reported_by AS "reportedBy",
        b.created_at AS "createdAt",
        b.updated_at AS "updatedAt"
      FROM bugs b
      LEFT JOIN sprints s ON s.id = b.sprint_id
      LEFT JOIN sprints cs ON cs.id = b.completed_in_sprint_id
      LEFT JOIN sprints rs ON rs.id = b.rollover_from_sprint_id
      WHERE b.id = ${id}
      LIMIT 1
    `;

    const bug = rows[0];
    if (!bug) {
      throw new NotFoundException('Bug no encontrado.');
    }

    return bug;
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
      throw new ForbiddenException('No tienes permiso para este proyecto.');
    }
  }

  private async getNextPosition(projectId: string, section: BacklogSection): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ nextPosition: number }>>`
      SELECT COALESCE(MAX(position), -1) + 1 AS "nextPosition"
      FROM bugs
      WHERE project_id = ${projectId}
        AND section = ${section}
    `;

    return rows[0]?.nextPosition ?? 0;
  }

  /** Código corto del proyecto (RYA). Si aún no tiene, se le asigna con la misma regla que el script SQL. */
  private async getProjectCodePrefix(projectId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ code: string | null }>>`
      UPDATE projects
      SET code = COALESCE(code, qualio_project_code(name, id))
      WHERE id = ${projectId}
      RETURNING code
    `;

    return rows[0]?.code ?? 'PRJ';
  }

  private async reserveNextSequence(projectId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ nextValue: number }>>`
      INSERT INTO project_item_sequences (project_id, last_value, updated_at)
      VALUES (${projectId}, 1, NOW())
      ON CONFLICT (project_id)
      DO UPDATE SET
        last_value = project_item_sequences.last_value + 1,
        updated_at = NOW()
      RETURNING last_value AS "nextValue"
    `;

    return rows[0]?.nextValue ?? 1;
  }

  private async resolveActiveSprintId(projectId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM sprints
      WHERE project_id = ${projectId}
        AND status = 'ACTIVE'
      ORDER BY sequence DESC
      LIMIT 1
    `;

    const activeSprintId = rows[0]?.id;
    if (!activeSprintId) {
      throw new ForbiddenException('No hay un sprint activo para enviar tickets al tablero.');
    }

    return activeSprintId;
  }
}
