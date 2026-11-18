import { api } from './api';

export const API_TOKEN_SCOPES = [
  'projects:read',
  'projects:write',
  'tickets:read',
  'tickets:write',
  'comments:write',
  'evidences:read',
  'evidences:write',
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export const API_TOKEN_EXPIRATIONS = ['30d', '90d', '365d', 'never'] as const;

export type ApiTokenExpiration = (typeof API_TOKEN_EXPIRATIONS)[number];

export type ApiToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreateApiTokenPayload = {
  name: string;
  scopes: ApiTokenScope[];
  expiration: ApiTokenExpiration;
};

export type CreatedApiToken = {
  /** Valor completo del token: la API solo lo entrega en esta respuesta. */
  token: string;
  apiToken: ApiToken;
};

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function listApiTokens(accessToken: string): Promise<ApiToken[]> {
  const { data } = await api.get<ApiToken[]>('/auth/api-tokens', authHeader(accessToken));
  return data;
}

export async function createApiToken(accessToken: string, payload: CreateApiTokenPayload): Promise<CreatedApiToken> {
  const { data } = await api.post<CreatedApiToken>('/auth/api-tokens', payload, authHeader(accessToken));
  return data;
}

export async function revokeApiToken(accessToken: string, tokenId: string): Promise<void> {
  await api.delete(`/auth/api-tokens/${tokenId}`, authHeader(accessToken));
}
