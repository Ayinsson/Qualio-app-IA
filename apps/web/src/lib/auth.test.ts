import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './api';
import { resolveSession } from './auth';

vi.mock('./api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

function httpError(status: number): AxiosError {
  return new AxiosError('request failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

const SESSION = { user: { sub: 'user-1', email: 'ana@qualio.test' } };
const RENEWED = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  user: { id: 'user-1', email: 'ana@qualio.test', name: 'Ana', emailVerified: false },
};

describe('resolveSession', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('keeps a session whose access token is accepted', async () => {
    get.mockResolvedValueOnce({ data: SESSION });

    await expect(resolveSession('access', 'refresh')).resolves.toEqual({ status: 'valid', session: SESSION });
    expect(post).not.toHaveBeenCalled();
  });

  it('renews the session when the access token is rejected but the refresh token works', async () => {
    get.mockRejectedValueOnce(httpError(401));
    post.mockResolvedValueOnce({ data: RENEWED });

    await expect(resolveSession('expired', 'refresh-token')).resolves.toEqual({ status: 'refreshed', auth: RENEWED });
    expect(post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'refresh-token' });
  });

  it('marks a stale session as invalid when the refresh token is also rejected', async () => {
    get.mockRejectedValueOnce(httpError(401));
    post.mockRejectedValueOnce(httpError(401));

    await expect(resolveSession('stale', 'stale-refresh')).resolves.toEqual({ status: 'invalid' });
  });

  it('marks the session as invalid when there is no refresh token to try', async () => {
    get.mockRejectedValueOnce(httpError(401));

    await expect(resolveSession('stale', null)).resolves.toEqual({ status: 'invalid' });
    expect(post).not.toHaveBeenCalled();
  });

  it('does not discard the session when the API is unreachable', async () => {
    get.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'));

    await expect(resolveSession('access', 'refresh')).rejects.toBeInstanceOf(AxiosError);
    expect(post).not.toHaveBeenCalled();
  });

  it('does not discard the session when the refresh endpoint fails with a server error', async () => {
    get.mockRejectedValueOnce(httpError(401));
    post.mockRejectedValueOnce(httpError(500));

    await expect(resolveSession('expired', 'refresh')).rejects.toBeInstanceOf(AxiosError);
  });
});
