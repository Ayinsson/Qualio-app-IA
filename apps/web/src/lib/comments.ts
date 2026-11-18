import { api } from './api';

export type WorkItemComment = {
  id: string;
  entityType: 'TASK' | 'BUG';
  entityId: string;
  projectId: string;
  body: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  authorAvatarUrl: string | null;
  /** Si lo escribió un agente o integración, el token que usó. */
  apiTokenId: string | null;
  apiTokenName: string | null;
  createdAt: string;
};

function path(entityType: 'TASK' | 'BUG', entityId: string): string {
  return `/${entityType === 'TASK' ? 'tasks' : 'bugs'}/${entityId}/comments`;
}

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function listComments(
  accessToken: string,
  entityType: 'TASK' | 'BUG',
  entityId: string,
): Promise<WorkItemComment[]> {
  const { data } = await api.get<WorkItemComment[]>(path(entityType, entityId), authHeader(accessToken));
  return data;
}

export async function createComment(
  accessToken: string,
  entityType: 'TASK' | 'BUG',
  entityId: string,
  body: string,
): Promise<WorkItemComment> {
  const { data } = await api.post<WorkItemComment>(path(entityType, entityId), { body }, authHeader(accessToken));
  return data;
}
