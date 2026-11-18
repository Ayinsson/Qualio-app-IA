import type { TicketRef } from './planningFields';

const FINISHED = new Set(['DONE', 'RESOLVED', 'CLOSED']);

/** "Faltan 2 subtareas por cerrar" al intentar terminar un ticket con dependencias abiertas. */
export function openSubtasksMessage(subtasks: TicketRef[]): string | null {
  const open = subtasks.filter((ticket) => !FINISHED.has(ticket.status ?? '')).length;
  if (open === 0) {
    return null;
  }
  return open === 1
    ? 'Falta 1 subtarea por cerrar: no se podrá cerrar todavía.'
    : `Faltan ${open} subtareas por cerrar: no se podrá cerrar todavía.`;
}
