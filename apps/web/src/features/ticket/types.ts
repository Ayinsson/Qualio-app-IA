export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

/** Dónde queda un ticket nuevo. */
export type Destination = 'backlog' | 'next' | 'sprint';

export const DESTINATION_LABEL: Record<Destination, string> = {
  backlog: 'Backlog general',
  next: 'Próximo Sprint',
  sprint: 'el tablero del sprint',
};

export type NewTaskValues = {
  title: string;
  description: string;
  priority: Priority;
  assignedTo: string;
  dueDate: string;
  /** Fecha de inicio (AAAA-MM-DD) o vacío. */
  startDate: string;
  /** Macroactividad del Planning o vacío (sin planificar). */
  stageGroupId: string;
  /** "TASK:id" o "BUG:id" si se crea como subtarea; vacío si no. */
  parent: string;
};

export type NewBugValues = {
  title: string;
  description: string;
  priority: Priority;
  environment: string;
  expectedResult: string;
  actualResult: string;
  dueDate: string;
  /** Fecha de inicio (AAAA-MM-DD) o vacío. */
  startDate: string;
  /** Macroactividad del Planning o vacío (sin planificar). */
  stageGroupId: string;
  /** "TASK:id" o "BUG:id" si se crea como subtarea; vacío si no. */
  parent: string;
};

export const ATTACHMENTS_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  'image/*',
  'video/*',
].join(',');

export const ENVIRONMENTS = ['QA', 'Staging', 'Producción'];
