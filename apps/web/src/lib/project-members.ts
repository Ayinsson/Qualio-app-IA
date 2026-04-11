import { api } from './api';

export type ProjectMember = {
  projectId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

export type AddProjectMemberPayload = {
  email: string;
  role?: 'ADMIN' | 'MEMBER';
};

function authHeader(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function listProjectMembers(accessToken: string, projectId: string): Promise<ProjectMember[]> {
  const { data } = await api.get<ProjectMember[]>(`/projects/${projectId}/members`, authHeader(accessToken));
  return data;
}

export async function addProjectMember(
  accessToken: string,
  projectId: string,
  payload: AddProjectMemberPayload,
): Promise<ProjectMember[]> {
  const { data } = await api.post<ProjectMember[]>(`/projects/${projectId}/members`, payload, authHeader(accessToken));
  return data;
}

export async function removeProjectMember(accessToken: string, projectId: string, userId: string): Promise<{ success: true }> {
  const { data } = await api.delete<{ success: true }>(`/projects/${projectId}/members/${userId}`, authHeader(accessToken));
  return data;
}
