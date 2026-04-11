import { api } from './api';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type ProjectType = 'Tienda B2B O B2C' | 'App movil' | 'App web' | 'Otro';

export type Project = {
  id: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  projectType: ProjectType | null;
  ownerId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  totalTestCases: number;
  totalBugs: number;
  openBugs: number;
};

export type CreateProjectPayload = {
  name: string;
  logoUrl?: string;
  description?: string;
  projectType: ProjectType;
};

export type UpdateProjectPayload = {
  name?: string;
  logoUrl?: string | null;
  status?: ProjectStatus;
};

function authHeader(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function listProjects(accessToken: string, status?: ProjectStatus): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/projects', {
    ...authHeader(accessToken),
    params: status ? { status } : undefined,
  });

  return data;
}

export async function createProject(accessToken: string, payload: CreateProjectPayload): Promise<Project> {
  const { data } = await api.post<Project>('/projects', payload, authHeader(accessToken));
  return data;
}

export async function getProject(accessToken: string, id: string): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${id}`, authHeader(accessToken));
  return data;
}

export async function updateProject(
  accessToken: string,
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${id}`, payload, authHeader(accessToken));
  return data;
}

export async function archiveProject(accessToken: string, id: string): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${id}/archive`, {}, authHeader(accessToken));
  return data;
}

export async function getProjectSummary(accessToken: string, id: string): Promise<ProjectSummary> {
  const { data } = await api.get<ProjectSummary>(`/projects/${id}/summary`, authHeader(accessToken));
  return data;
}
