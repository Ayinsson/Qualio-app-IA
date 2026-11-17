import { api } from './api';

export type ProjectMember = {
  projectId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  name: string | null;
  email: string;
  avatarUrl: string | null;
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

export async function removeProjectMember(accessToken: string, projectId: string, userId: string): Promise<{ success: true }> {
  const { data } = await api.delete<{ success: true }>(`/projects/${projectId}/members/${userId}`, authHeader(accessToken));
  return data;
}
