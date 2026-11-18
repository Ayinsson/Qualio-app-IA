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
};

export type NewBugValues = {
  title: string;
  description: string;
  priority: Priority;
  environment: string;
  expectedResult: string;
  actualResult: string;
  dueDate: string;
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
