/** Prefijo visible de todos los tokens de API ("qlo" = Qualio). */
export const API_TOKEN_PREFIX = 'qlo_';

/**
 * Permisos que se le pueden conceder a un token de API.
 * Los endpoints que aceptan tokens declaran los que necesitan con @RequireScopes.
 */
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

export const DEFAULT_API_TOKEN_EXPIRATION: ApiTokenExpiration = '90d';
