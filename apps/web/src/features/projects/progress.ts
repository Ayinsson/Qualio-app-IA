import type { Bug } from '../../lib/bugs';
import type { Sprint } from '../../lib/sprints';
import type { Task } from '../../lib/tasks';

// El endpoint /projects/:id/summary de la API todavía devuelve ceros fijos, así que el avance
// se calcula aquí a partir de las listas reales de tareas y bugs.

const DONE_TASK = new Set(['DONE']);
const DONE_BUG = new Set(['RESOLVED', 'CLOSED']);
const OPEN_BUG = new Set(['OPEN', 'IN_PROGRESS']);

export type ProjectProgress = {
  /** Tickets (tareas + bugs) del sprint activo; 0 si no hay sprint. */
  sprintTotal: number;
  sprintDone: number;
  /** Porcentaje del sprint activo (0–100). */
  percent: number;
  /** Tickets que esperan en el backlog (Próximo Sprint + Backlog general). */
  backlogCount: number;
  openBugs: number;
  highOpenBugs: number;
};

export function computeProgress(
  tasks: Task[] | undefined,
  bugs: Bug[] | undefined,
  sprint: Sprint | null | undefined,
): ProjectProgress | null {
  if (!tasks || !bugs) {
    return null;
  }

  const inSprint = (item: { sprintId: string | null; section: string }) =>
    Boolean(sprint) && (item.sprintId === sprint?.id || item.section === 'SPRINT_BOARD');

  const sprintTasks = tasks.filter(inSprint);
  const sprintBugs = bugs.filter(inSprint);
  const sprintTotal = sprintTasks.length + sprintBugs.length;
  const sprintDone =
    sprintTasks.filter((task) => DONE_TASK.has(task.status)).length +
    sprintBugs.filter((bug) => DONE_BUG.has(bug.status)).length;

  const backlogCount =
    tasks.filter((task) => task.section !== 'SPRINT_BOARD' && !DONE_TASK.has(task.status)).length +
    bugs.filter((bug) => bug.section !== 'SPRINT_BOARD' && !DONE_BUG.has(bug.status)).length;

  const open = bugs.filter((bug) => OPEN_BUG.has(bug.status));

  return {
    sprintTotal,
    sprintDone,
    percent: sprintTotal > 0 ? Math.round((sprintDone / sprintTotal) * 100) : 0,
    backlogCount,
    openBugs: open.length,
    highOpenBugs: open.filter((bug) => bug.priority === 'HIGH').length,
  };
}

/** Texto de avance: "2 de 6 tickets del sprint" o "4 tickets en backlog". */
export function progressLabel(progress: ProjectProgress, hasSprint: boolean): string {
  if (hasSprint) {
    return `${progress.sprintDone} de ${progress.sprintTotal} ${progress.sprintTotal === 1 ? 'ticket' : 'tickets'} del sprint`;
  }
  return `${progress.backlogCount} ${progress.backlogCount === 1 ? 'ticket' : 'tickets'} en backlog`;
}
