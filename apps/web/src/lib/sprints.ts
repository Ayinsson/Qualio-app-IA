import { api } from './api';

export type Sprint = {
  id: string;
  projectId: string;
  sequence: number;
  name: string;
  status: 'ACTIVE' | 'CLOSED';
  startedAt: string;
  closedAt: string | null;
  createdBy: string;
  createdAt: string;
};

function authHeader(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function getActiveSprint(accessToken: string, projectId: string): Promise<Sprint | null> {
  const { data } = await api.get<Sprint | null>(`/projects/${projectId}/sprints/active`, authHeader(accessToken));
  return data;
}

export async function startSprint(accessToken: string, projectId: string): Promise<Sprint> {
  const { data } = await api.post<Sprint>(`/projects/${projectId}/sprints/start`, {}, authHeader(accessToken));
  return data;
}

export async function listSprints(accessToken: string, projectId: string): Promise<Sprint[]> {
  const { data } = await api.get<Sprint[]>(`/projects/${projectId}/sprints`, authHeader(accessToken));
  return data;
}
