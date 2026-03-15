import { api } from './api';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  avatarUrl?: string | null;
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

export type UpdateProfilePayload = {
  name: string;
  email: string;
};

export type UpdateProfileResponse = {
  user: AuthUser;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
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

export async function updateProfile(
  accessToken: string,
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResponse> {
  const { data } = await api.patch<UpdateProfileResponse>('/auth/profile', payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return data;
}

export async function changePassword(
  accessToken: string,
  payload: ChangePasswordPayload,
): Promise<{ success: true }> {
  const { data } = await api.patch<{ success: true }>('/auth/password', payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return data;
}

export async function updateAvatar(
  accessToken: string,
  avatarUrl: string,
): Promise<UpdateProfileResponse> {
  const { data } = await api.patch<UpdateProfileResponse>(
    '/auth/avatar',
    { avatarUrl },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return data;
}
