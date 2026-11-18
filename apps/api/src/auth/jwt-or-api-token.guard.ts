import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { setRequestApiTokenId } from '../common/request-context';
import { type ApiTokenScope } from './api-tokens/api-token-scopes';
import { ApiTokensService, isApiToken } from './api-tokens/api-tokens.service';
import { AuthPayload } from './auth.types';
import { REQUIRED_SCOPES_KEY } from './require-scopes.decorator';

type GuardedRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthPayload;
};

/**
 * Acepta la sesión web (JWT) o un token de API personal (`Bearer qlo_...`).
 * Con token de API exige que el endpoint declare @RequireScopes y que el token
 * tenga todos esos permisos (denegado por defecto).
 */
@Injectable()
export class JwtOrApiTokenGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiTokensService: ApiTokensService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const token = extractBearerToken(request);

    if (!token || !isApiToken(token)) {
      return (await super.canActivate(context)) as boolean;
    }

    const requiredScopes = this.reflector.getAllAndOverride<ApiTokenScope[] | undefined>(REQUIRED_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes?.length) {
      throw new ForbiddenException('Este endpoint no está disponible con tokens de API.');
    }

    const payload = await this.apiTokensService.authenticate(token);
    const granted = payload.scopes ?? [];
    const missing = requiredScopes.filter((scope) => !granted.includes(scope));

    if (missing.length > 0) {
      throw new ForbiddenException(`El token no tiene los permisos requeridos: ${missing.join(', ')}.`);
    }

    request.user = payload;
    if (payload.tokenId) {
      setRequestApiTokenId(payload.tokenId);
    }
    return true;
  }
}

export function extractBearerToken(request: Pick<GuardedRequest, 'headers'>): string | null {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) {
    return null;
  }

  const [scheme, token] = value.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}
