import { api } from './api';

export type AppNotification = {
  id: string;
  userId: string;
  type:
    | 'INVITATION_PENDING'
    | 'INVITATION_ACCEPTED'
    | 'INVITATION_REJECTED'
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'BUG_CREATED'
    | 'BUG_UPDATED';
  title: string;
  message: string;
  projectId: string | null;
  entityType: 'INVITATION' | 'TASK' | 'BUG' | null;
  entityId: string | null;
  actionType: 'INVITATION_RESPONSE' | null;
  actionId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorAvatarUrl: string | null;
};

export type CreateInvitationPayload = {
  email: string;
  role?: 'ADMIN' | 'MEMBER';
};

export type ProjectPendingInvitation = {
  id: string;
  projectId: string;
  projectName: string;
  inviterUserId: string;
  inviterName: string | null;
  inviterEmail: string;
  invitedEmail: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  isRead: boolean;
  createdAt: string;
  respondedAt: string | null;
};

function authHeader(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function listInvitationNotifications(
  accessToken: string,
  params?: { limit?: number; offset?: number },
): Promise<AppNotification[]> {
  const query = new URLSearchParams();
  if (typeof params?.limit === 'number') {
    query.set('limit', String(params.limit));
  }
  if (typeof params?.offset === 'number') {
    query.set('offset', String(params.offset));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const { data } = await api.get<AppNotification[]>(`/invitations/notifications${suffix}`, authHeader(accessToken));
  return data;
}

export async function createInvitation(
  accessToken: string,
  projectId: string,
  payload: CreateInvitationPayload,
): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/projects/${projectId}/invitations`, payload, authHeader(accessToken));
  return data;
}

export async function acceptInvitation(accessToken: string, invitationId: string): Promise<{ success: true }> {
  const { data } = await api.patch<{ success: true }>(`/invitations/${invitationId}/accept`, {}, authHeader(accessToken));
  return data;
}

export async function rejectInvitation(accessToken: string, invitationId: string): Promise<{ success: true }> {
  const { data } = await api.patch<{ success: true }>(`/invitations/${invitationId}/reject`, {}, authHeader(accessToken));
  return data;
}

export async function markAllInvitationsRead(accessToken: string): Promise<{ success: true }> {
  const { data } = await api.patch<{ success: true }>('/invitations/read-all', {}, authHeader(accessToken));
  return data;
}

export async function listProjectPendingInvitations(
  accessToken: string,
  projectId: string,
): Promise<ProjectPendingInvitation[]> {
  const { data } = await api.get<ProjectPendingInvitation[]>(`/projects/${projectId}/invitations/pending`, authHeader(accessToken));
  return data;
}

export async function cancelProjectInvitation(
  accessToken: string,
  projectId: string,
  invitationId: string,
): Promise<{ success: true }> {
  const { data } = await api.delete<{ success: true }>(`/projects/${projectId}/invitations/${invitationId}`, authHeader(accessToken));
  return data;
}
