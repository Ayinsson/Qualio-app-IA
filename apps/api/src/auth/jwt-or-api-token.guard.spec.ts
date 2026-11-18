import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { ApiTokensService } from './api-tokens/api-tokens.service';
import { AuthPayload } from './auth.types';
import { JwtOrApiTokenGuard } from './jwt-or-api-token.guard';

const TOKEN_PAYLOAD: AuthPayload = {
  sub: 'user-1',
  email: 'ana@qualio.test',
  authType: 'api_token',
  tokenId: 'token-1',
  scopes: ['tickets:read', 'tickets:write'],
};

function contextFor(request: { headers: Record<string, string>; user?: AuthPayload }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('JwtOrApiTokenGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let apiTokens: { authenticate: jest.Mock };
  let guard: JwtOrApiTokenGuard;
  let jwtCanActivate: jest.SpyInstance;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    apiTokens = { authenticate: jest.fn().mockResolvedValue(TOKEN_PAYLOAD) };
    guard = new JwtOrApiTokenGuard(reflector as unknown as Reflector, apiTokens as unknown as ApiTokensService);
    jwtCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtOrApiTokenGuard.prototype) as InstanceType<ReturnType<typeof AuthGuard>>, 'canActivate')
      .mockResolvedValue(true);
  });

  afterEach(() => jwtCanActivate.mockRestore());

  it('delegates regular bearer tokens to the JWT strategy', async () => {
    const context = contextFor({ headers: { authorization: 'Bearer eyJhbGciOi.jwt.token' } });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwtCanActivate).toHaveBeenCalledWith(context);
    expect(apiTokens.authenticate).not.toHaveBeenCalled();
  });

  it('accepts an API token that has every required scope and sets req.user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['tickets:write']);
    const request: { headers: Record<string, string>; user?: AuthPayload } = {
      headers: { authorization: 'Bearer qlo_secret' },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(apiTokens.authenticate).toHaveBeenCalledWith('qlo_secret');
    expect(request.user).toEqual(TOKEN_PAYLOAD);
    expect(jwtCanActivate).not.toHaveBeenCalled();
  });

  it('rejects API tokens on endpoints that do not declare scopes, without touching the database', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Bearer qlo_secret' } }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(apiTokens.authenticate).not.toHaveBeenCalled();
  });

  it('rejects an API token missing a required scope and names it', async () => {
    reflector.getAllAndOverride.mockReturnValue(['evidences:write']);

    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Bearer qlo_secret' } }))).rejects.toThrow(
      'evidences:write',
    );
  });

  it('propagates invalid token errors', async () => {
    reflector.getAllAndOverride.mockReturnValue(['tickets:read']);
    apiTokens.authenticate.mockRejectedValue(new UnauthorizedException());

    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Bearer qlo_bad' } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
