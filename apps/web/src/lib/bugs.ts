import { api } from './api';

export type BacklogSectionApi = 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
export type BugPriorityApi = 'HIGH' | 'MEDIUM' | 'LOW';
export type BugStatusApi = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type Bug = {
  id: string;
  itemKey: string | null;
  projectId: string;
  title: string;
  description: string;
  priority: BugPriorityApi;
  status: BugStatusApi;
  section: BacklogSectionApi;
  position: number;
  environment: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  sprintId: string | null;
  sprintName: string | null;
  sprintSequence: number | null;
  completedInSprintId: string | null;
  completedInSprintName: string | null;
  completedInSprintSequence: number | null;
  rolloverFromSprintId: string | null;
  rolloverFromSprintName: string | null;
  rolloverFromSprintSequence: number | null;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateBugPayload = {
  title: string;
  description: string;
  priority?: BugPriorityApi;
  section?: BacklogSectionApi;
  environment?: string;
  expectedResult?: string;
  actualResult?: string;
};

export type MoveBugPayload = {
  section: BacklogSectionApi;
  targetPosition: number;
};

export type UpdateBugPayload = {
  title?: string;
  description?: string;
  priority?: BugPriorityApi;
  status?: BugStatusApi;
  section?: BacklogSectionApi;
  environment?: string;
  expectedResult?: string;
  actualResult?: string;
  changeNote?: string;
};

export type WorkItemHistory = {
  id: string;
  entityType: 'TASK' | 'BUG';
  entityId: string;
  projectId: string;
  changedBy: string;
  changedByName: string | null;
  changedByEmail: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeNote: string | null;
  createdAt: string;
};

function authHeader(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function listBugs(accessToken: string, projectId: string): Promise<Bug[]> {
  const { data } = await api.get<Bug[]>(`/projects/${projectId}/bugs`, authHeader(accessToken));
  return data;
}

export async function createBug(accessToken: string, projectId: string, payload: CreateBugPayload): Promise<Bug> {
  const { data } = await api.post<Bug>(`/projects/${projectId}/bugs`, payload, authHeader(accessToken));
  return data;
}

export async function moveBug(accessToken: string, id: string, payload: MoveBugPayload): Promise<Bug> {
  const { data } = await api.patch<Bug>(`/bugs/${id}/move`, payload, authHeader(accessToken));
  return data;
}

export async function updateBug(accessToken: string, id: string, payload: UpdateBugPayload): Promise<Bug> {
  const { data } = await api.patch<Bug>(`/bugs/${id}`, payload, authHeader(accessToken));
  return data;
}

export async function listBugHistory(accessToken: string, id: string): Promise<WorkItemHistory[]> {
  const { data } = await api.get<WorkItemHistory[]>(`/bugs/${id}/history`, authHeader(accessToken));
  return data;
}

export async function reopenBug(accessToken: string, id: string): Promise<Bug> {
  const { data } = await api.patch<Bug>(`/bugs/${id}/reopen`, {}, authHeader(accessToken));
  return data;
}
