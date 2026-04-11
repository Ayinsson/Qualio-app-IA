import { api } from './api';

export type BacklogSectionApi = 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';
export type TaskPriorityApi = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatusApi = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type Task = {
  id: string;
  itemKey: string | null;
  projectId: string;
  title: string;
  description: string | null;
  priority: TaskPriorityApi;
  status: TaskStatusApi;
  section: BacklogSectionApi;
  position: number;
  assignedTo: string | null;
  dueDate: string | null;
  sprintId: string | null;
  sprintName: string | null;
  sprintSequence: number | null;
  completedInSprintId: string | null;
  completedInSprintName: string | null;
  completedInSprintSequence: number | null;
  rolloverFromSprintId: string | null;
  rolloverFromSprintName: string | null;
  rolloverFromSprintSequence: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  priority?: TaskPriorityApi;
  section?: BacklogSectionApi;
  assignedTo?: string;
  dueDate?: string;
  sprintId?: string;
};

export type MoveTaskPayload = {
  section: BacklogSectionApi;
  targetPosition: number;
};

export type UpdateTaskPayload = {
  title?: string;
  description?: string;
  priority?: TaskPriorityApi;
  status?: TaskStatusApi;
  section?: BacklogSectionApi;
  assignedTo?: string | null;
  dueDate?: string | null;
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

export async function listTasks(accessToken: string, projectId: string): Promise<Task[]> {
  const { data } = await api.get<Task[]>(`/projects/${projectId}/tasks`, authHeader(accessToken));
  return data;
}

export async function createTask(accessToken: string, projectId: string, payload: CreateTaskPayload): Promise<Task> {
  const { data } = await api.post<Task>(`/projects/${projectId}/tasks`, payload, authHeader(accessToken));
  return data;
}

export async function moveTask(accessToken: string, id: string, payload: MoveTaskPayload): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}/move`, payload, authHeader(accessToken));
  return data;
}

export async function updateTask(accessToken: string, id: string, payload: UpdateTaskPayload): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}`, payload, authHeader(accessToken));
  return data;
}

export async function listTaskHistory(accessToken: string, id: string): Promise<WorkItemHistory[]> {
  const { data } = await api.get<WorkItemHistory[]>(`/tasks/${id}/history`, authHeader(accessToken));
  return data;
}

export async function reopenTask(accessToken: string, id: string): Promise<Task> {
  const { data } = await api.patch<Task>(`/tasks/${id}/reopen`, {}, authHeader(accessToken));
  return data;
}
