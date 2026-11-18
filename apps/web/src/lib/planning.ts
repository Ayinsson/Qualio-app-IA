import { api } from './api';

export type PlanStatus = 'NO_TICKETS' | 'NOT_STARTED' | 'COMPLETED' | 'DELAYED' | 'AT_RISK' | 'ON_TRACK';

export type ProgressStats = {
  total: number;
  /** Suma de créditos: puede tener decimales por el avance parcial de subtareas. */
  done: number;
  committed: number;
  added: number;
  actualPct: number | null;
  expectedPct: number;
  status: PlanStatus;
  forecastEnd: string | null;
  slipDays: number;
};

export type PlanTicket = {
  type: 'TASK' | 'BUG';
  id: string;
  itemKey: string | null;
  title: string;
  status: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  startDate: string | null;
  dueDate: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  stageGroupId: string | null;
  parentType: 'TASK' | 'BUG' | null;
  parentId: string | null;
  isDone: boolean;
  subtasks: { done: number; total: number };
  addedAfterStart: boolean;
};

export type PlanGroup = {
  id: string;
  stageId: string;
  projectId: string;
  position: number;
  name: string;
  ownerName: string | null;
  startDate: string;
  endDate: string;
  stats: ProgressStats;
  tickets: PlanTicket[];
};

export type PlanStage = {
  id: string;
  projectId: string;
  position: number;
  code: string | null;
  name: string;
  ownerName: string | null;
  startDate: string;
  endDate: string;
  deliverables: string | null;
  exitCriteria: string | null;
  createdOn: string;
  stats: ProgressStats;
  groups: PlanGroup[];
};

export type PlanningView = {
  today: string;
  project: { overallPct: number | null; plannedEnd: string | null; forecastEnd: string | null; slipDays: number };
  stages: PlanStage[];
  unplannedTickets: PlanTicket[];
};

export type StagePayload = {
  code?: string | null;
  name: string;
  ownerName?: string | null;
  startDate: string;
  endDate: string;
  deliverables?: string | null;
  exitCriteria?: string | null;
};

export type GroupPayload = {
  name: string;
  ownerName?: string | null;
  startDate: string;
  endDate: string;
};

export type MoveDirection = 'up' | 'down';

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function getPlanning(accessToken: string, projectId: string): Promise<PlanningView> {
  const { data } = await api.get<PlanningView>(`/projects/${projectId}/planning`, authHeader(accessToken));
  return data;
}

export async function createStage(accessToken: string, projectId: string, payload: StagePayload): Promise<void> {
  await api.post(`/projects/${projectId}/stages`, payload, authHeader(accessToken));
}

export async function updateStage(
  accessToken: string,
  stageId: string,
  payload: Partial<StagePayload> & { move?: MoveDirection },
): Promise<void> {
  await api.patch(`/stages/${stageId}`, payload, authHeader(accessToken));
}

export async function deleteStage(accessToken: string, stageId: string): Promise<void> {
  await api.delete(`/stages/${stageId}`, authHeader(accessToken));
}

export async function createGroup(accessToken: string, stageId: string, payload: GroupPayload): Promise<void> {
  await api.post(`/stages/${stageId}/groups`, payload, authHeader(accessToken));
}

export async function updateGroup(
  accessToken: string,
  groupId: string,
  payload: Partial<GroupPayload> & { move?: MoveDirection },
): Promise<void> {
  await api.patch(`/stage-groups/${groupId}`, payload, authHeader(accessToken));
}

export async function deleteGroup(accessToken: string, groupId: string): Promise<void> {
  await api.delete(`/stage-groups/${groupId}`, authHeader(accessToken));
}

/** Asigna (o quita, con null) la macroactividad de una tarea o un bug. */
export async function assignTicketToGroup(
  accessToken: string,
  ticket: { type: 'TASK' | 'BUG'; id: string },
  stageGroupId: string | null,
): Promise<void> {
  const path = ticket.type === 'TASK' ? `/tasks/${ticket.id}` : `/bugs/${ticket.id}`;
  await api.patch(path, { stageGroupId }, authHeader(accessToken));
}
