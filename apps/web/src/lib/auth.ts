import { api } from './api';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type SessionUserResponse = {
  user: {
    sub: string;
    email: string;
  };
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name?: string;
};

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function getSessionUser(accessToken: string): Promise<SessionUserResponse> {
  const { data } = await api.get<SessionUserResponse>('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return data;
}
