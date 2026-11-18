import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { type WorkItemType } from './work-item-types';

/** Basta con $queryRaw: sirve con el cliente normal o dentro de una transacción. */
type Db = Pick<PrismaService, '$queryRaw'>;

export type { WorkItemType } from './work-item-types';

export function isFinishedStatus(type: WorkItemType, status: string): boolean {
  return type === 'TASK' ? status === 'DONE' : status === 'RESOLVED' || status === 'CLOSED';
}

type ParentRow = { id: string; itemKey: string | null; parentId: string | null; stageGroupId: string | null };

/**
 * Una subtarea es una dependencia: no se puede cerrar el ticket padre mientras
 * tenga subtareas abiertas.
 */
export async function assertNoOpenSubtasks(db: Db, parentType: WorkItemType, parentId: string): Promise<void> {
  const rows = await db.$queryRaw<Array<{ itemKey: string | null }>>`
    SELECT item_key AS "itemKey" FROM tasks
    WHERE parent_entity_type = ${parentType} AND parent_entity_id = ${parentId} AND status <> 'DONE'
    UNION ALL
    SELECT item_key AS "itemKey" FROM bugs
    WHERE parent_entity_type = ${parentType} AND parent_entity_id = ${parentId} AND status NOT IN ('RESOLVED', 'CLOSED')
  `;

  if (rows.length > 0) {
    const keys = rows.map((row) => row.itemKey ?? 'sin clave').join(', ');
    throw new BadRequestException(
      `No se puede cerrar: ${rows.length === 1 ? 'falta 1 subtarea' : `faltan ${rows.length} subtareas`} por cerrar (${keys}).`,
    );
  }
}

/**
 * Valida que un ticket pueda ser subtarea del padre indicado: el padre existe en el
 * mismo proyecto, no es a su vez subtarea (un solo nivel) y el hijo no tiene subtareas.
 */
export async function assertValidParent(
  db: Db,
  input: {
    projectId: string;
    parentType: WorkItemType;
    parentId: string;
    child?: { type: WorkItemType; id: string };
  },
): Promise<ParentRow> {
  const { projectId, parentType, parentId, child } = input;

  if (child && child.type === parentType && child.id === parentId) {
    throw new BadRequestException('Un ticket no puede ser subtarea de sí mismo.');
  }

  const parents =
    parentType === 'TASK'
      ? await db.$queryRaw<ParentRow[]>`
          SELECT id, item_key AS "itemKey", parent_entity_id AS "parentId", stage_group_id AS "stageGroupId"
          FROM tasks WHERE id = ${parentId} AND project_id = ${projectId} LIMIT 1
        `
      : await db.$queryRaw<ParentRow[]>`
          SELECT id, item_key AS "itemKey", parent_entity_id AS "parentId", stage_group_id AS "stageGroupId"
          FROM bugs WHERE id = ${parentId} AND project_id = ${projectId} LIMIT 1
        `;

  const parent = parents[0];
  if (!parent) {
    throw new BadRequestException('El ticket padre no existe en este proyecto.');
  }
  if (parent.parentId) {
    throw new BadRequestException(`${parent.itemKey ?? 'El ticket padre'} ya es una subtarea; solo se permite un nivel.`);
  }

  if (child) {
    const [{ count }] = await db.$queryRaw<Array<{ count: number }>>`
      SELECT (
        (SELECT COUNT(*) FROM tasks WHERE parent_entity_type = ${child.type} AND parent_entity_id = ${child.id}) +
        (SELECT COUNT(*) FROM bugs WHERE parent_entity_type = ${child.type} AND parent_entity_id = ${child.id})
      )::int AS count
    `;
    if (count > 0) {
      throw new BadRequestException('Este ticket tiene subtareas; no puede ser subtarea de otro.');
    }
  }

  return parent;
}

/** La macroactividad debe existir y pertenecer al mismo proyecto que el ticket. */
export async function assertStageGroupInProject(db: Db, projectId: string, stageGroupId: string): Promise<void> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM project_stage_groups WHERE id = ${stageGroupId} AND project_id = ${projectId} LIMIT 1
  `;
  if (rows.length === 0) {
    throw new BadRequestException('La macroactividad no existe en este proyecto.');
  }
}

export type PlanningLinks = {
  stageGroupId: string | null;
  parentType: WorkItemType | null;
  parentId: string | null;
};

const SUBTASK_INHERITS_STAGE = 'Una subtarea hereda la etapa de su ticket padre; no se le puede asignar otra.';

/** Etapa y padre de un ticket nuevo. Una subtarea no guarda macroactividad propia. */
export async function resolvePlanningOnCreate(
  db: Db,
  projectId: string,
  input: { stageGroupId?: string; parentType?: WorkItemType; parentId?: string },
): Promise<PlanningLinks> {
  if (input.parentId || input.parentType) {
    if (!input.parentId || !input.parentType) {
      throw new BadRequestException('Indica el tipo y el id del ticket padre.');
    }
    if (input.stageGroupId) {
      throw new BadRequestException(SUBTASK_INHERITS_STAGE);
    }
    await assertValidParent(db, { projectId, parentType: input.parentType, parentId: input.parentId });
    return { stageGroupId: null, parentType: input.parentType, parentId: input.parentId };
  }

  if (input.stageGroupId) {
    await assertStageGroupInProject(db, projectId, input.stageGroupId);
  }
  return { stageGroupId: input.stageGroupId ?? null, parentType: null, parentId: null };
}

/**
 * Etapa y padre al editar. `undefined` deja el valor actual; `null` lo quita.
 * `stageChanged` indica si hay que mover la fecha de planificación (línea base).
 */
export async function resolvePlanningOnUpdate(
  db: Db,
  input: {
    projectId: string;
    type: WorkItemType;
    id: string;
    current: PlanningLinks;
    changes: { stageGroupId?: string | null; parentType?: WorkItemType | null; parentId?: string | null };
  },
): Promise<PlanningLinks & { stageChanged: boolean }> {
  const { projectId, type, id, current, changes } = input;
  let { parentType, parentId } = current;

  if (changes.parentId !== undefined) {
    if (changes.parentId === null) {
      parentType = null;
      parentId = null;
    } else {
      const nextType = changes.parentType ?? null;
      if (!nextType) {
        throw new BadRequestException('Indica el tipo y el id del ticket padre.');
      }
      if (nextType !== current.parentType || changes.parentId !== current.parentId) {
        await assertValidParent(db, { projectId, parentType: nextType, parentId: changes.parentId, child: { type, id } });
      }
      parentType = nextType;
      parentId = changes.parentId;
    }
  }

  let stageGroupId = parentId ? null : current.stageGroupId;
  if (changes.stageGroupId !== undefined) {
    if (changes.stageGroupId !== null) {
      if (parentId) {
        throw new BadRequestException(SUBTASK_INHERITS_STAGE);
      }
      if (changes.stageGroupId !== current.stageGroupId) {
        await assertStageGroupInProject(db, projectId, changes.stageGroupId);
      }
    }
    if (!parentId) {
      stageGroupId = changes.stageGroupId;
    }
  }

  return { stageGroupId, parentType, parentId, stageChanged: stageGroupId !== current.stageGroupId };
}
