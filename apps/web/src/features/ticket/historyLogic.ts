// Convierte el historial técnico de la API (status: TODO → IN_PROGRESS, assigned_to: <uuid>...)
// en frases que una persona entiende: "cambió el estado de Pendiente a En progreso".

export type HistoryEntry = {
  id: string;
  changedBy: string;
  changedByName: string | null;
  changedByEmail: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeNote: string | null;
  apiTokenName?: string | null;
  createdAt: string;
};

export type Part = { text: string; strong?: boolean };

export type ActivityEvent = {
  id: string;
  actorId: string;
  actorName: string;
  at: string;
  /** Una frase por cambio, en partes para resaltar los valores. */
  lines: Part[][];
  note: string | null;
  /** Nombre del token de API si el cambio lo hizo un agente o integración. */
  via: string | null;
};

type Context = {
  itemType: 'task' | 'bug';
  memberName: (userId: string) => string | null;
};

const TASK_STATUS: Record<string, string> = { TODO: 'Pendiente', IN_PROGRESS: 'En progreso', DONE: 'Hecho' };
const BUG_STATUS: Record<string, string> = {
  OPEN: 'Bug abierto',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};
const SECTION: Record<string, string> = {
  GENERAL_BACKLOG: 'Backlog general',
  NEXT_SPRINT: 'Próximo Sprint',
  SPRINT_BOARD: 'tablero del sprint',
};
const PRIORITY: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

/** Campos internos que no aportan a una persona (los cubre el cambio de sección/estado). */
const HIDDEN_FIELDS = new Set(['sprint_id', 'completed_in_sprint_id', 'rollover_from_sprint_id', 'position']);

const strong = (text: string): Part => ({ text, strong: true });
const plain = (text: string): Part => ({ text });

function dueLabel(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
    .format(new Date(year, month - 1, day))
    .replace('.', '');
}

export function describeChange(entry: HistoryEntry, context: Context): Part[] | null {
  const { fieldName, oldValue, newValue } = entry;
  if (HIDDEN_FIELDS.has(fieldName)) {
    return null;
  }

  switch (fieldName) {
    case 'status': {
      const table = context.itemType === 'bug' ? BUG_STATUS : TASK_STATUS;
      const from = oldValue ? table[oldValue] ?? oldValue : null;
      const to = newValue ? table[newValue] ?? newValue : '—';
      return from
        ? [plain('cambió el estado de '), strong(from), plain(' a '), strong(to)]
        : [plain('puso el estado en '), strong(to)];
    }
    case 'section': {
      const from = oldValue ? SECTION[oldValue] ?? oldValue : null;
      const to = newValue ? SECTION[newValue] ?? newValue : '—';
      return from ? [plain('lo pasó de '), strong(from), plain(' a '), strong(to)] : [plain('lo puso en '), strong(to)];
    }
    case 'priority':
      return [
        plain('cambió la prioridad de '),
        strong(PRIORITY[oldValue ?? ''] ?? oldValue ?? '—'),
        plain(' a '),
        strong(PRIORITY[newValue ?? ''] ?? newValue ?? '—'),
      ];
    case 'assigned_to':
      if (!newValue) {
        return [plain('quitó la asignación')];
      }
      return [plain('lo asignó a '), strong(context.memberName(newValue) ?? 'otra persona')];
    case 'due_date':
      return newValue
        ? [plain('cambió la fecha objetivo al '), strong(dueLabel(newValue))]
        : [plain('quitó la fecha objetivo')];
    case 'title':
      return [plain('cambió el título a '), strong(`"${newValue ?? ''}"`)];
    case 'description':
      return [plain('editó la descripción')];
    case 'environment':
      return newValue ? [plain('cambió el entorno a '), strong(newValue)] : [plain('quitó el entorno')];
    case 'expected_result':
      return [plain('editó el resultado esperado')];
    case 'actual_result':
      return [plain('editó el resultado obtenido')];
    default:
      return [plain(`cambió ${fieldName.replace(/_/g, ' ')}`)];
  }
}

/**
 * Agrupa los cambios guardados juntos (misma persona, mismo segundo) en un solo evento,
 * del más reciente al más antiguo. Los eventos que solo tocan campos internos se omiten.
 */
export function buildActivity(entries: HistoryEntry[], context: Context): ActivityEvent[] {
  const groups = new Map<string, ActivityEvent>();

  [...entries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .forEach((entry) => {
      const key = `${entry.changedBy}|${entry.createdAt.slice(0, 19)}`;
      const line = describeChange(entry, context);
      const group = groups.get(key) ?? {
        id: entry.id,
        actorId: entry.changedBy,
        actorName: entry.changedByName?.trim() || entry.changedByEmail,
        at: entry.createdAt,
        lines: [],
        note: null,
        via: entry.apiTokenName ?? null,
      };
      if (line) {
        group.lines.push(line);
      }
      if (!group.note && entry.changeNote?.trim()) {
        group.note = entry.changeNote.trim();
      }
      groups.set(key, group);
    });

  return [...groups.values()].filter((event) => event.lines.length > 0);
}

/** "hoy, 10:42", "ayer, 23:32" o "16 nov, 10:42". */
export function formatEventTime(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
  if (date.toDateString() === now.toDateString()) {
    return `hoy, ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `ayer, ${time}`;
  }
  const day = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date).replace('.', '');
  return `${day}, ${time}`;
}
