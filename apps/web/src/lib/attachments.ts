import { api } from './api';

export type AttachmentEntityType = 'TASK' | 'BUG';

export type WorkItemAttachment = {
  id: string;
  entityType: AttachmentEntityType;
  entityId: string;
  projectId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
};

export type RegisterAttachmentPayload = {
  entityType: AttachmentEntityType;
  entityId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

function authHeader(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function registerAttachment(
  accessToken: string,
  payload: RegisterAttachmentPayload,
): Promise<WorkItemAttachment> {
  const { data } = await api.post<WorkItemAttachment>('/attachments', payload, authHeader(accessToken));
  return data;
}

export async function listAttachments(
  accessToken: string,
  entityType: AttachmentEntityType,
  entityId: string,
): Promise<WorkItemAttachment[]> {
  const { data } = await api.get<WorkItemAttachment[]>(`/attachments/${entityType}/${entityId}`, authHeader(accessToken));
  return data;
}
