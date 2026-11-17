import type { Bug } from '../../lib/bugs';
import type { Task } from '../../lib/tasks';

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const OPEN_BUG_STATUSES = new Set(['OPEN', 'IN_PROGRESS']);

export type ProjectRef = { id: string; name: string };
export type WithProject<T> = T & { project: ProjectRef };

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) {
    return 'Buenos días';
  }
  if (hour < 19) {
    return 'Buenas tardes';
  }
  return 'Buenas noches';
}

export function firstName(name: string | null | undefined, email: string | null | undefined): string {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) {
    return fromName;
  }
  return email?.split('@')[0] ?? '';
}

/**
 * Una fecha de vencimiento es un día del calendario, no un instante. La API la devuelve como
 * medianoche UTC ('2026-11-16T00:00:00.000Z'); convertirla a hora local la correría al día
 * anterior en zonas UTC−x. Por eso se toma solo la parte AAAA-MM-DD.
 */
export function parseDueDate(value: string): Date {
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (datePart) {
    return new Date(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3]));
  }
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export type DueInfo = { label: string; tone: 'late' | 'soon' | 'normal' };

export function describeDue(dueDate: string | null, now: Date = new Date()): DueInfo | null {
  if (!dueDate) {
    return null;
  }

  const due = parseDueDate(dueDate);
  const days = Math.round((due.getTime() - startOfDay(now).getTime()) / 86_400_000);
  const short = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(due);

  if (days < 0) {
    return { label: `Venció el ${short}`, tone: 'late' };
  }
  if (days === 0) {
    return { label: 'Vence hoy', tone: 'late' };
  }
  if (days === 1) {
    return { label: 'Vence mañana', tone: 'soon' };
  }
  return { label: short, tone: 'normal' };
}

/** Tareas sin terminar asignadas a la persona, por prioridad y luego por fecha. */
export function assignedTasks(tasks: Array<WithProject<Task>>, userId: string | null): Array<WithProject<Task>> {
  if (!userId) {
    return [];
  }

  return tasks
    .filter((task) => task.assignedTo === userId && task.status !== 'DONE')
    .sort((a, b) => {
      const byPriority = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
      if (byPriority !== 0) {
        return byPriority;
      }
      const aDue = a.dueDate ? parseDueDate(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? parseDueDate(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });
}

/** Bugs de prioridad alta todavía abiertos, del más reciente al más antiguo. */
export function urgentBugs(bugs: Array<WithProject<Bug>>): Array<WithProject<Bug>> {
  return bugs
    .filter((bug) => bug.priority === 'HIGH' && OPEN_BUG_STATUSES.has(bug.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type SummaryPart = { text: string; strong?: boolean };

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** Resumen en una frase de lo que necesita atención hoy. */
export function buildSummary(
  tasks: Array<WithProject<Task>>,
  bugs: Array<WithProject<Bug>>,
  now: Date = new Date(),
): SummaryPart[] {
  const parts: SummaryPart[] = [];

  if (tasks.length === 0) {
    parts.push({ text: 'No tienes tareas pendientes asignadas.' });
  } else {
    parts.push({ text: 'Tienes ' });
    parts.push({ text: `${tasks.length} ${plural(tasks.length, 'tarea asignada', 'tareas asignadas')}`, strong: true });

    const urgent = tasks.filter((task) => describeDue(task.dueDate, now)?.tone === 'late').length;
    if (urgent > 0) {
      parts.push({
        text: `, ${urgent} ${plural(urgent, 'vence hoy o está vencida', 'vencen hoy o están vencidas')}`,
      });
    }
    parts.push({ text: '.' });
  }

  if (bugs.length === 0) {
    parts.push({ text: ' No hay bugs de prioridad alta abiertos.' });
    return parts;
  }

  const projects = new Set(bugs.map((bug) => bug.project.id));
  parts.push({ text: ' Hay ' });
  parts.push({
    text: `${bugs.length} ${plural(bugs.length, 'bug de prioridad alta abierto', 'bugs de prioridad alta abiertos')}`,
    strong: true,
  });
  if (projects.size === 1) {
    parts.push({ text: ' en ' });
    parts.push({ text: bugs[0].project.name, strong: true });
    parts.push({ text: '.' });
  } else {
    parts.push({ text: ` en ${projects.size} proyectos.` });
  }

  return parts;
}

/** "hace 5 min", "hace 2 h", "ayer" o la fecha corta. */
export function reportedAgo(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);

  if (minutes < 1) {
    return 'ahora';
  }
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }
  if (date.toDateString() === now.toDateString()) {
    return `hace ${Math.round(minutes / 60)} h`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'ayer';
  }

  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date);
}
