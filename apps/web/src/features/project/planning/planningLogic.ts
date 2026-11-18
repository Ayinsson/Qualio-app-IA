import type { PlanStatus, PlanTicket, ProgressStats } from '../../../lib/planning';
import type { StatusTone } from '../../../ui';

/** Clave de TanStack Query del planning de un proyecto (la invalidan los cambios de tickets). */
export function planningQueryKey(projectId: string) {
  return ['planning', projectId] as const;
}

export const PLAN_STATUS: Record<PlanStatus, { label: string; tone: StatusTone }> = {
  ON_TRACK: { label: 'En tiempo', tone: 'success' },
  AT_RISK: { label: 'En riesgo', tone: 'blocked' },
  DELAYED: { label: 'Atrasada', tone: 'danger' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  NOT_STARTED: { label: 'Sin iniciar', tone: 'neutral' },
  NO_TICKETS: { label: 'Sin tickets', tone: 'neutral' },
};

const DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_YEAR = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "2 nov" (o "2 nov 2027" si no es el año indicado). Acepta AAAA-MM-DD o ISO. */
export function formatPlanDate(value: string | null, currentYear?: number): string {
  if (!value) {
    return '—';
  }
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  const format = currentYear !== undefined && date.getUTCFullYear() !== currentYear ? DAY_YEAR : DAY;
  return format.format(date).replace('.', '');
}

export function formatRange(start: string | null, end: string | null, currentYear?: number): string {
  return `${formatPlanDate(start, currentYear)} → ${formatPlanDate(end, currentYear)}`;
}

/** "4,5 de 10 tickets" o "3 de 3 tickets". */
export function progressLabel(stats: Pick<ProgressStats, 'done' | 'total'>): string {
  const done = Number.isInteger(stats.done) ? String(stats.done) : stats.done.toFixed(1).replace('.', ',');
  return `${done} de ${stats.total} ${stats.total === 1 ? 'ticket' : 'tickets'}`;
}

/** Frase corta de la proyección de una etapa o del proyecto. */
export function forecastLabel(stats: Pick<ProgressStats, 'status' | 'forecastEnd' | 'slipDays'>, currentYear?: number): string | null {
  if (stats.status === 'COMPLETED' || stats.status === 'NO_TICKETS' || stats.status === 'NOT_STARTED') {
    return null;
  }
  if (stats.forecastEnd && stats.slipDays > 0) {
    return `A este ritmo termina el ${formatPlanDate(stats.forecastEnd, currentYear)} · ${stats.slipDays} ${stats.slipDays === 1 ? 'día hábil' : 'días hábiles'} tarde`;
  }
  if (stats.forecastEnd) {
    return `A este ritmo termina el ${formatPlanDate(stats.forecastEnd, currentYear)}`;
  }
  if (stats.status === 'DELAYED') {
    return `Vencida hace ${stats.slipDays} ${stats.slipDays === 1 ? 'día hábil' : 'días hábiles'} y sin tickets cerrados`;
  }
  return 'Aún sin tickets cerrados para proyectar';
}

const TICKET_STATUS: Record<string, string> = {
  TODO: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  DONE: 'Hecho',
  OPEN: 'Abierto',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

export function ticketStatusLabel(status: string): string {
  return TICKET_STATUS[status] ?? status;
}

/** Busca por clave o título, sin tildes ni mayúsculas. */
export function matchesTicket(ticket: Pick<PlanTicket, 'itemKey' | 'title'>, query: string): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const needle = normalize(query.trim());
  return !needle || normalize(`${ticket.itemKey ?? ''} ${ticket.title}`).includes(needle);
}

/**
 * Si hoy se agrega trabajo a la etapa, ¿cuenta como alcance agregado?
 * Igual que la línea base del API: el corte es el inicio de la etapa o el día en que se
 * creó (si el plan se armó con la etapa en curso). Una etapa ya terminada no aplica.
 */
export function addsScopeToday(stage: { startDate: string; endDate: string; createdOn: string }, today: string): boolean {
  const baseline = stage.createdOn > stage.startDate ? stage.createdOn : stage.startDate;
  return today > baseline && today <= stage.endDate;
}
