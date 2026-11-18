import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { ApiTokensService, isApiToken } from '../../auth/api-tokens/api-tokens.service';
import { AuthPayload } from '../../auth/auth.types';
import { extractBearerToken } from '../../auth/jwt-or-api-token.guard';
import { setRequestApiTokenId } from '../../common/request-context';

/**
 * El servidor MCP solo acepta tokens de API: cada herramienta se habilita
 * según los permisos del token, y todo queda trazado con su nombre.
 */
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthPayload;
    }>();
    const token = extractBearerToken(request);

    if (!token || !isApiToken(token)) {
      throw new UnauthorizedException(
        'Conecta el servidor MCP con un token de API de Qualio: Authorization: Bearer qlo_… (créalo en Perfil → Tokens de API).',
      );
    }

    const payload = await this.apiTokensService.authenticate(token);
    request.user = payload;
    if (payload.tokenId) {
      setRequestApiTokenId(payload.tokenId);
    }
    return true;
  }
}
