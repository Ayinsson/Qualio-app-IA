// Lógica pura del sistema base (separada de los componentes para Fast Refresh y tests).

export type StatusTone = 'neutral' | 'running' | 'blocked' | 'success' | 'danger';

/** Estados de tareas y bugs tal como llegan de la API o se muestran en la UI. */
export type WorkItemStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'OPEN'
  | 'RESOLVED'
  | 'Pendiente'
  | 'En progreso'
  | 'Bloqueado'
  | 'Completado';

type StatusPreset = { tone: StatusTone; label: string };

const taskStatus: Record<string, StatusPreset> = {
  TODO: { tone: 'neutral', label: 'Pendiente' },
  Pendiente: { tone: 'neutral', label: 'Pendiente' },
  IN_PROGRESS: { tone: 'running', label: 'En progreso' },
  'En progreso': { tone: 'running', label: 'En progreso' },
  BLOCKED: { tone: 'blocked', label: 'Bloqueado' },
  Bloqueado: { tone: 'blocked', label: 'Bloqueado' },
  DONE: { tone: 'success', label: 'Completado' },
  Completado: { tone: 'success', label: 'Completado' },
};

const bugStatus: Record<string, StatusPreset> = {
  ...taskStatus,
  OPEN: { tone: 'danger', label: 'Bug abierto' },
  TODO: { tone: 'danger', label: 'Bug abierto' },
  Pendiente: { tone: 'danger', label: 'Bug abierto' },
  RESOLVED: { tone: 'success', label: 'Resuelto' },
  DONE: { tone: 'success', label: 'Resuelto' },
  Completado: { tone: 'success', label: 'Resuelto' },
};

/** Traduce un estado de tarea o bug a su tono de color y etiqueta visible. */
export function resolveStatus(status: string, itemType: 'task' | 'bug' = 'task'): StatusPreset {
  const table = itemType === 'bug' ? bugStatus : taskStatus;
  return table[status] ?? { tone: 'neutral', label: status };
}


/** Valores de prioridad usados hoy en la app ('Medio'/'Bajo') y en la API (high/medium/low). */
export type PriorityValue = 'Alta' | 'Medio' | 'Media' | 'Bajo' | 'Baja' | 'HIGH' | 'MEDIUM' | 'LOW' | 'high' | 'medium' | 'low';

const levels: Record<string, { level: 1 | 2 | 3; label: string }> = {
  Alta: { level: 3, label: 'Alta' },
  HIGH: { level: 3, label: 'Alta' },
  high: { level: 3, label: 'Alta' },
  Medio: { level: 2, label: 'Media' },
  Media: { level: 2, label: 'Media' },
  MEDIUM: { level: 2, label: 'Media' },
  medium: { level: 2, label: 'Media' },
  Bajo: { level: 1, label: 'Baja' },
  Baja: { level: 1, label: 'Baja' },
  LOW: { level: 1, label: 'Baja' },
  low: { level: 1, label: 'Baja' },
};

export function resolvePriority(value: string): { level: 1 | 2 | 3; label: string } {
  return levels[value] ?? { level: 1, label: value };
}


// Colores de fondo para iniciales; todos con contraste suficiente para texto blanco.
const AVATAR_COLORS = ['#057b82', '#042467', '#4f6580', '#2d7a4a', '#0a5f96', '#8a5200'];

export function getInitials(name: string): string {
  const parts = name
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  const first = parts[0][0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : parts[0][1] ?? '';
  return (first + second).toUpperCase();
}

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}


/** Ids que el control debe recibir en aria-describedby. */
export function fieldDescribedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
