export type BacklogSectionId = 'nextSprint' | 'general';

/** Ticket del backlog tal como lo arma ProjectDetailView a partir de tareas y bugs. */
export type PlanItem = {
  id: string;
  displayKey: string;
  entityId: string;
  title: string;
  itemType: 'task' | 'bug';
  priority: 'Alta' | 'Medio' | 'Bajo';
  assigneeUserId: string | null;
  dueDate: string | null;
  section: BacklogSectionId;
  position: number;
  /** Clave del ticket padre si es subtarea (se muestra como "↳ RYA-020"). */
  parentKey?: string | null;
};

export type ProjectTabId = 'backlog' | 'board' | 'done' | 'planning' | 'reports';

export type BoardColumnId = 'todo' | 'progress' | 'done';

/** Tarjeta del tablero del sprint activo (tarea o bug). */
export type BoardCard = {
  id: string;
  entityId: string;
  itemType: 'task' | 'bug';
  displayKey: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  column: BoardColumnId;
  assigneeUserId: string | null;
  dueDate: string | null;
  environment: string | null;
  /** Nombre del sprint del que viene arrastrado, si aplica. */
  rolloverFrom: string | null;
  /** Clave del ticket padre si es subtarea (se muestra como "↳ RYA-020"). */
  parentKey?: string | null;
};

/** Ticket terminado dentro de un sprint (pestaña Completado). */
export type DoneItem = {
  id: string;
  entityId: string;
  itemType: 'task' | 'bug';
  displayKey: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Sprint en el que se terminó; null si se cerró fuera de un sprint (desde el backlog o importado). */
  sprintId: string | null;
  sprintName: string;
  sprintSequence: number;
  /** Última modificación: la API no guarda el instante exacto en que se terminó. */
  completedAt: string;
};

export type ReopenDestination = 'backlog' | 'sprint';
