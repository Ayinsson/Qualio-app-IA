import { AxiosError } from 'axios';

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

export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
  return data;
}

/**
 * Outcome of checking a stored session against the API:
 * - `valid`: the access token is accepted as is.
 * - `refreshed`: the access token was rejected but the refresh token produced new tokens.
 * - `invalid`: neither token is accepted; the stored session must be discarded.
 */
export type SessionResolution =
  | { status: 'valid'; session: SessionUserResponse }
  | { status: 'refreshed'; auth: AuthResponse }
  | { status: 'invalid' };

function isRejectedCredential(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  const status = error.response?.status;
  // 400 covers a malformed refresh token rejected by DTO validation.
  return status === 401 || status === 400;
}

/**
 * Validates the stored access token and, if the API rejects it, tries the refresh token once.
 * Network or server errors are rethrown so a temporary outage never logs the user out.
 */
export async function resolveSession(
  accessToken: string,
  refreshToken: string | null,
): Promise<SessionResolution> {
  try {
    return { status: 'valid', session: await getSessionUser(accessToken) };
  } catch (error) {
    if (!(error instanceof AxiosError) || error.response?.status !== 401) {
      throw error;
    }
  }

  if (!refreshToken) {
    return { status: 'invalid' };
  }

  try {
    return { status: 'refreshed', auth: await refreshSession(refreshToken) };
  } catch (error) {
    if (isRejectedCredential(error)) {
      return { status: 'invalid' };
    }

    throw error;
  }
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

export async function removeAvatar(accessToken: string): Promise<UpdateProfileResponse> {
  const { data } = await api.delete<UpdateProfileResponse>('/auth/avatar', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return data;
}
