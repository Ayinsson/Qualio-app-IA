import { SetMetadata } from '@nestjs/common';

import { type ApiTokenScope } from './api-tokens/api-token-scopes';

export const REQUIRED_SCOPES_KEY = 'requiredApiTokenScopes';

/**
 * Habilita el endpoint para tokens de API y declara los permisos que el token
 * debe tener. Las sesiones web (JWT) no se ven afectadas.
 * Un endpoint sin este decorador rechaza los tokens de API.
 */
export const RequireScopes = (...scopes: ApiTokenScope[]) => SetMetadata(REQUIRED_SCOPES_KEY, scopes);
