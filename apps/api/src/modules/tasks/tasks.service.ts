import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectMembersService } from '../project-members/project-members.service';
import { CreateTaskDto, type BacklogSection } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export type TaskEntity = {
  id: string;
  itemKey: string | null;
  projectId: string;
  title: string;
  description: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  section: 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
  position: number;
  assignedTo: string | null;
  dueDate: Date | null;
  sprintId: string | null;
  sprintName: string | null;
  sprintSequence: number | null;
  completedInSprintId: string | null;
  completedInSprintName: string | null;
  completedInSprintSequence: number | null;
  rolloverFromSprintId: string | null;
  rolloverFromSprintName: string | null;
  rolloverFromSprintSequence: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskHistoryEntry = {
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
  createdAt: Date;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectMembersService: ProjectMembersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(ownerId: string, projectId: string, dto: CreateTaskDto): Promise<TaskEntity> {
    await this.ensureProjectOwnership(projectId, ownerId);

    if (dto.assignedTo) {
      await this.projectMembersService.ensureParticipant(projectId, dto.assignedTo);
    }

    const section = dto.section ?? 'GENERAL_BACKLOG';
    const sprintId = section === 'SPRINT_BOARD' ? await this.resolveActiveSprintId(projectId, dto.sprintId) : null;
    const nextPosition = await this.getNextPosition(projectId, section);
    const projectCode = await this.getProjectCodePrefix(projectId);
    const nextSequence = await this.reserveNextSequence(projectId);
    const itemKey = `${projectCode}-${String(nextSequence).padStart(3, '0')}`;

    const rows = await this.prisma.$queryRaw<TaskEntity[]>`
      INSERT INTO tasks (
        id,
        item_key,
        project_id,
        title,
        description,
        priority,
        status,
        section,
        position,
        assigned_to,
        due_date,
        sprint_id,
        completed_in_sprint_id,
        rollover_from_sprint_id,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${randomUUID()},
        ${itemKey},
        ${projectId},
        ${dto.title.trim()},
        ${dto.description?.trim() ?? null},
        ${dto.priority ?? 'MEDIUM'},
        'TODO',
        ${section},
        ${nextPosition},
        ${dto.assignedTo?.trim() ?? null},
        ${dto.dueDate ? new Date(dto.dueDate) : null},
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
        assigned_to AS "assignedTo",
        due_date AS "dueDate",
        sprint_id AS "sprintId",
        NULL::VARCHAR AS "sprintName",
        NULL::INT AS "sprintSequence",
        completed_in_sprint_id AS "completedInSprintId",
        NULL::VARCHAR AS "completedInSprintName",
        NULL::INT AS "completedInSprintSequence",
        rollover_from_sprint_id AS "rolloverFromSprintId",
        NULL::VARCHAR AS "rolloverFromSprintName",
        NULL::INT AS "rolloverFromSprintSequence",
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const created = rows[0];

    await this.notificationsService.notifyProjectAudience(projectId, ownerId, {
      type: 'TASK_CREATED',
      title: `Nueva tarea ${created.itemKey ?? created.id}`,
      message: `${dto.title.trim()} fue creada en el proyecto.`,
      projectId,
      entityType: 'TASK',
      entityId: created.id,
    });

    return created;
  }

  async findAll(ownerId: string, projectId: string, section?: BacklogSection): Promise<TaskEntity[]> {
    await this.ensureProjectOwnership(projectId, ownerId);

    if (section) {
      return this.prisma.$queryRaw<TaskEntity[]>`
        SELECT
          t.id,
          t.item_key AS "itemKey",
          t.project_id AS "projectId",
          t.title,
          t.description,
          t.priority,
          t.status,
          t.section,
          t.position,
          t.assigned_to AS "assignedTo",
          t.due_date AS "dueDate",
          t.sprint_id AS "sprintId",
          s.name AS "sprintName",
          s.sequence AS "sprintSequence",
          t.completed_in_sprint_id AS "completedInSprintId",
          cs.name AS "completedInSprintName",
          cs.sequence AS "completedInSprintSequence",
          t.rollover_from_sprint_id AS "rolloverFromSprintId",
          rs.name AS "rolloverFromSprintName",
          rs.sequence AS "rolloverFromSprintSequence",
          t.created_by AS "createdBy",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt"
        FROM tasks t
        LEFT JOIN sprints s ON s.id = t.sprint_id
        LEFT JOIN sprints cs ON cs.id = t.completed_in_sprint_id
        LEFT JOIN sprints rs ON rs.id = t.rollover_from_sprint_id
        WHERE t.project_id = ${projectId}
          AND t.section = ${section}
        ORDER BY t.section, t.position, t.created_at
      `;
    }

    return this.prisma.$queryRaw<TaskEntity[]>`
      SELECT
        t.id,
        t.item_key AS "itemKey",
        t.project_id AS "projectId",
        t.title,
        t.description,
        t.priority,
        t.status,
        t.section,
        t.position,
        t.assigned_to AS "assignedTo",
        t.due_date AS "dueDate",
        t.sprint_id AS "sprintId",
        s.name AS "sprintName",
        s.sequence AS "sprintSequence",
        t.completed_in_sprint_id AS "completedInSprintId",
        cs.name AS "completedInSprintName",
        cs.sequence AS "completedInSprintSequence",
        t.rollover_from_sprint_id AS "rolloverFromSprintId",
        rs.name AS "rolloverFromSprintName",
        rs.sequence AS "rolloverFromSprintSequence",
        t.created_by AS "createdBy",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM tasks t
      LEFT JOIN sprints s ON s.id = t.sprint_id
      LEFT JOIN sprints cs ON cs.id = t.completed_in_sprint_id
      LEFT JOIN sprints rs ON rs.id = t.rollover_from_sprint_id
      WHERE t.project_id = ${projectId}
      ORDER BY t.section, t.position, t.created_at
    `;
  }

  async move(ownerId: string, id: string, dto: MoveTaskDto): Promise<TaskEntity> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);
    const targetSprintId = dto.section === 'SPRINT_BOARD' ? await this.resolveActiveSprintId(current.projectId) : null;

    await this.prisma.$transaction(async (tx) => {
      if (current.section === dto.section) {
        if (dto.targetPosition > current.position) {
          await tx.$executeRaw`
            UPDATE tasks
            SET position = position - 1,
                updated_at = NOW()
            WHERE project_id = ${current.projectId}
              AND section = ${current.section}
              AND position > ${current.position}
              AND position <= ${dto.targetPosition}
          `;
        } else if (dto.targetPosition < current.position) {
          await tx.$executeRaw`
            UPDATE tasks
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
          UPDATE tasks
          SET position = position - 1,
              updated_at = NOW()
          WHERE project_id = ${current.projectId}
            AND section = ${current.section}
            AND position > ${current.position}
        `;

        await tx.$executeRaw`
          UPDATE tasks
          SET position = position + 1,
              updated_at = NOW()
          WHERE project_id = ${current.projectId}
            AND section = ${dto.section}
            AND position >= ${dto.targetPosition}
        `;
      }

      await tx.$executeRaw`
        UPDATE tasks
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
      type: 'TASK_UPDATED',
      title: `Tarea movida ${moved.itemKey ?? moved.id}`,
      message: `Se movio a ${dto.section}.`,
      projectId: current.projectId,
      entityType: 'TASK',
      entityId: id,
    });

    return moved;
  }

  async update(ownerId: string, id: string, dto: UpdateTaskDto): Promise<TaskEntity> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);

    const assignedTo = dto.assignedTo === undefined ? current.assignedTo : dto.assignedTo;
    if (assignedTo) {
      await this.projectMembersService.ensureParticipant(current.projectId, assignedTo);
    }

    const nextTitle = dto.title?.trim() ?? current.title;
    const nextDescription = dto.description === undefined ? current.description : dto.description.trim();
    const nextPriority = dto.priority ?? current.priority;
    const nextStatus = dto.status ?? current.status;
    const isReopen = current.status === 'DONE' && nextStatus !== 'DONE';
    const nextSection = isReopen ? 'GENERAL_BACKLOG' : dto.section ?? current.section;
    const nextDueDate = dto.dueDate === undefined ? current.dueDate : dto.dueDate === null ? null : new Date(dto.dueDate);
    const nextSprintId = isReopen
      ? null
      : nextSection === 'SPRINT_BOARD'
        ? current.sprintId ?? (await this.resolveActiveSprintId(current.projectId))
        : null;
    const nextCompletedInSprintId =
      isReopen || nextStatus !== 'DONE'
        ? null
        : current.section === 'SPRINT_BOARD' && current.sprintId
          ? current.sprintId
          : current.completedInSprintId;
    const nextRolloverFromSprintId = isReopen ? null : current.rolloverFromSprintId;

    const changePairs = [
      { field: 'title', oldValue: current.title, newValue: nextTitle },
      { field: 'description', oldValue: current.description ?? null, newValue: nextDescription ?? null },
      { field: 'priority', oldValue: current.priority, newValue: nextPriority },
      { field: 'status', oldValue: current.status, newValue: nextStatus },
      { field: 'section', oldValue: current.section, newValue: nextSection },
      { field: 'assigned_to', oldValue: current.assignedTo ?? null, newValue: assignedTo ?? null },
      { field: 'sprint_id', oldValue: current.sprintId ?? null, newValue: nextSprintId ?? null },
      {
        field: 'completed_in_sprint_id',
        oldValue: current.completedInSprintId ?? null,
        newValue: nextCompletedInSprintId ?? null,
      },
      {
        field: 'due_date',
        oldValue: current.dueDate ? current.dueDate.toISOString() : null,
        newValue: nextDueDate ? nextDueDate.toISOString() : null,
      },
    ].filter((entry) => (entry.oldValue ?? null) !== (entry.newValue ?? null));

    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TaskEntity[]>`
        UPDATE tasks
        SET
          title = ${nextTitle},
          description = ${nextDescription},
          priority = ${nextPriority},
          status = ${nextStatus},
          section = ${nextSection},
          sprint_id = ${nextSprintId},
          completed_in_sprint_id = ${nextCompletedInSprintId},
          rollover_from_sprint_id = ${nextRolloverFromSprintId},
          assigned_to = ${assignedTo},
          due_date = ${nextDueDate},
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
          assigned_to AS "assignedTo",
          due_date AS "dueDate",
          sprint_id AS "sprintId",
          NULL::VARCHAR AS "sprintName",
          NULL::INT AS "sprintSequence",
          completed_in_sprint_id AS "completedInSprintId",
          NULL::VARCHAR AS "completedInSprintName",
          NULL::INT AS "completedInSprintSequence",
          rollover_from_sprint_id AS "rolloverFromSprintId",
          NULL::VARCHAR AS "rolloverFromSprintName",
          NULL::INT AS "rolloverFromSprintSequence",
          created_by AS "createdBy",
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
            created_at
          )
          VALUES (
            ${randomUUID()},
            'TASK',
            ${id},
            ${current.projectId},
            ${ownerId},
            ${entry.field},
            ${entry.oldValue},
            ${entry.newValue},
            ${dto.changeNote?.trim() || null},
            NOW()
          )
        `;
      }

      return rows[0];
    });

    await this.notificationsService.notifyProjectAudience(current.projectId, ownerId, {
      type: 'TASK_UPDATED',
      title: `Tarea actualizada ${updated.itemKey ?? updated.id}`,
      message: dto.changeNote?.trim() || `${updated.title} recibio cambios.`,
      projectId: current.projectId,
      entityType: 'TASK',
      entityId: id,
    });

    return updated;
  }

  async history(ownerId: string, id: string): Promise<TaskHistoryEntry[]> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);

    return this.prisma.$queryRaw<TaskHistoryEntry[]>`
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
        h.created_at AS "createdAt"
      FROM work_item_history h
      JOIN users u ON u.id = h.changed_by
      WHERE h.entity_type = 'TASK'
        AND h.entity_id = ${id}
      ORDER BY h.created_at DESC
    `;
  }

  async reopen(ownerId: string, id: string): Promise<TaskEntity> {
    const current = await this.findById(id);
    await this.ensureProjectOwnership(current.projectId, ownerId);

    const updatedRows = await this.prisma.$queryRaw<TaskEntity[]>`
      UPDATE tasks
      SET status = 'TODO',
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
        assigned_to AS "assignedTo",
        due_date AS "dueDate",
        sprint_id AS "sprintId",
        NULL::VARCHAR AS "sprintName",
        NULL::INT AS "sprintSequence",
        completed_in_sprint_id AS "completedInSprintId",
        NULL::VARCHAR AS "completedInSprintName",
        NULL::INT AS "completedInSprintSequence",
        rollover_from_sprint_id AS "rolloverFromSprintId",
        NULL::VARCHAR AS "rolloverFromSprintName",
        NULL::INT AS "rolloverFromSprintSequence",
        created_by AS "createdBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    return updatedRows[0];
  }

  private async findById(id: string): Promise<TaskEntity> {
    const rows = await this.prisma.$queryRaw<TaskEntity[]>`
      SELECT
        t.id,
        t.item_key AS "itemKey",
        t.project_id AS "projectId",
        t.title,
        t.description,
        t.priority,
        t.status,
        t.section,
        t.position,
        t.assigned_to AS "assignedTo",
        t.due_date AS "dueDate",
        t.sprint_id AS "sprintId",
        s.name AS "sprintName",
        s.sequence AS "sprintSequence",
        t.completed_in_sprint_id AS "completedInSprintId",
        cs.name AS "completedInSprintName",
        cs.sequence AS "completedInSprintSequence",
        t.rollover_from_sprint_id AS "rolloverFromSprintId",
        rs.name AS "rolloverFromSprintName",
        rs.sequence AS "rolloverFromSprintSequence",
        t.created_by AS "createdBy",
        t.created_at AS "createdAt",
        t.updated_at AS "updatedAt"
      FROM tasks t
      LEFT JOIN sprints s ON s.id = t.sprint_id
      LEFT JOIN sprints cs ON cs.id = t.completed_in_sprint_id
      LEFT JOIN sprints rs ON rs.id = t.rollover_from_sprint_id
      WHERE t.id = ${id}
      LIMIT 1
    `;

    const task = rows[0];
    if (!task) {
      throw new NotFoundException('Tarea no encontrada.');
    }

    return task;
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
      FROM tasks
      WHERE project_id = ${projectId}
        AND section = ${section}
    `;

    return rows[0]?.nextPosition ?? 0;
  }

  private async getProjectCodePrefix(projectId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name
      FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `;

    const projectName = rows[0]?.name ?? 'project';
    const compact = projectName.replace(/[^A-Za-z0-9]/g, '');
    return (compact || 'project').slice(0, 24);
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

  private async resolveActiveSprintId(projectId: string, preferredSprintId?: string): Promise<string> {
    if (preferredSprintId) {
      const preferredRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM sprints
        WHERE id = ${preferredSprintId}
          AND project_id = ${projectId}
          AND status = 'ACTIVE'
        LIMIT 1
      `;

      if (preferredRows[0]?.id) {
        return preferredRows[0].id;
      }
    }

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
