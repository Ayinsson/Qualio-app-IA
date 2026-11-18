import type { ApiToken, ApiTokenExpiration, ApiTokenScope } from '../../lib/apiTokens';

export type ScopeOption = {
  scope: ApiTokenScope;
  label: string;
  /** Permiso que se marca solo al elegir este (editar o comentar sin poder ver no sirve). */
  requires?: ApiTokenScope;
};

export type ScopeGroup = {
  label: string;
  hint: string;
  options: ScopeOption[];
};

export const SCOPE_GROUPS: ScopeGroup[] = [
  {
    label: 'Proyectos',
    hint: 'Proyectos, sprints y reportes.',
    options: [
      { scope: 'projects:read', label: 'Ver' },
      { scope: 'projects:write', label: 'Crear y editar', requires: 'projects:read' },
    ],
  },
  {
    label: 'Tickets',
    hint: 'Tareas y bugs: consultar, comentar, crear, cerrar y reabrir.',
    options: [
      { scope: 'tickets:read', label: 'Ver' },
      { scope: 'comments:write', label: 'Comentar', requires: 'tickets:read' },
      { scope: 'tickets:write', label: 'Crear y editar', requires: 'tickets:read' },
    ],
  },
  {
    label: 'Evidencias',
    hint: 'Adjuntos de tareas y bugs.',
    options: [
      { scope: 'evidences:read', label: 'Ver' },
      { scope: 'evidences:write', label: 'Subir', requires: 'evidences:read' },
    ],
  },
];

const ALL_OPTIONS = SCOPE_GROUPS.flatMap((group) => group.options);

export const EXPIRATION_OPTIONS: { value: ApiTokenExpiration; label: string }[] = [
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: '365d', label: '1 año' },
  { value: 'never', label: 'Sin vencimiento' },
];

const SCOPE_LABELS: Record<ApiTokenScope, string> = {
  'projects:read': 'Ver proyectos',
  'projects:write': 'Editar proyectos',
  'tickets:read': 'Ver tickets',
  'tickets:write': 'Editar tickets',
  'comments:write': 'Comentar tickets',
  'evidences:read': 'Ver evidencias',
  'evidences:write': 'Subir evidencias',
};

export function scopeLabel(scope: ApiTokenScope): string {
  return SCOPE_LABELS[scope] ?? scope;
}

/**
 * Marca o desmarca un permiso. Marcar uno que necesita "ver" marca "ver";
 * desmarcar "ver" desmarca lo que dependía de él.
 */
export function toggleScope(current: ApiTokenScope[], scope: ApiTokenScope): ApiTokenScope[] {
  const next = new Set(current);

  if (next.has(scope)) {
    next.delete(scope);
    ALL_OPTIONS.filter((option) => option.requires === scope).forEach((option) => next.delete(option.scope));
  } else {
    next.add(scope);
    const requires = ALL_OPTIONS.find((option) => option.scope === scope)?.requires;
    if (requires) {
      next.add(requires);
    }
  }

  return ALL_OPTIONS.map((option) => option.scope).filter((item) => next.has(item));
}

export type TokenFormErrors = { name?: string; scopes?: string };

export function validateTokenForm(name: string, scopes: ApiTokenScope[]): TokenFormErrors {
  const errors: TokenFormErrors = {};
  const trimmed = name.trim();

  if (!trimmed) {
    errors.name = 'Ponle un nombre para reconocerlo, por ejemplo "Claude de mi equipo".';
  } else if (trimmed.length < 2) {
    errors.name = 'Usa al menos 2 caracteres.';
  } else if (trimmed.length > 60) {
    errors.name = 'Usa como máximo 60 caracteres.';
  }

  if (scopes.length === 0) {
    errors.scopes = 'Elige al menos un permiso.';
  }

  return errors;
}

export type TokenState = 'active' | 'expired' | 'revoked';

export function tokenState(token: Pick<ApiToken, 'expiresAt' | 'revokedAt'>, now = Date.now()): TokenState {
  if (token.revokedAt) {
    return 'revoked';
  }
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= now) {
    return 'expired';
  }
  return 'active';
}

/** Activos primero (más recientes arriba), luego vencidos y revocados. */
export function sortTokens(tokens: ApiToken[], now = Date.now()): ApiToken[] {
  return [...tokens].sort((a, b) => {
    const aActive = tokenState(a, now) === 'active' ? 0 : 1;
    const bActive = tokenState(b, now) === 'active' ? 0 : 1;
    if (aActive !== bActive) {
      return aActive - bActive;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

export function formatLastUsed(value: string | null, now = Date.now()): string {
  if (!value) {
    return 'Nunca usado';
  }
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) {
    return 'Usado hace un momento';
  }
  if (minutes < 60) {
    return `Usado hace ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Usado hace ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return days === 1 ? 'Usado ayer' : `Usado hace ${days} días`;
  }
  return `Usado el ${formatDate(value)}`;
}

export function formatExpiry(token: Pick<ApiToken, 'expiresAt' | 'revokedAt'>, now = Date.now()): string {
  const state = tokenState(token, now);
  if (state === 'revoked') {
    return `Revocado el ${formatDate(token.revokedAt as string)}`;
  }
  if (!token.expiresAt) {
    return 'Sin vencimiento';
  }
  return state === 'expired' ? `Venció el ${formatDate(token.expiresAt)}` : `Vence el ${formatDate(token.expiresAt)}`;
}

export type ConnectionKind = 'claude-code' | 'mcp-json' | 'rest';

export const CONNECTION_OPTIONS: { value: ConnectionKind; label: string; hint: string }[] = [
  { value: 'claude-code', label: 'Claude Code', hint: 'Pega el comando en tu terminal.' },
  {
    value: 'mcp-json',
    label: 'Otros agentes (MCP)',
    hint: 'Para Cursor, VS Code, Windsurf u otro cliente MCP con servidores HTTP: agrégalo a su configuración de servidores MCP.',
  },
  { value: 'rest', label: 'API REST', hint: 'Para scripts o integraciones propias.' },
];

/** Texto listo para copiar que conecta un agente o script con este token. */
export function connectionSnippet(kind: ConnectionKind, apiBaseUrl: string, token: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '');
  if (kind === 'claude-code') {
    return `claude mcp add --transport http qualio ${base}/mcp --header "Authorization: Bearer ${token}"`;
  }
  if (kind === 'mcp-json') {
    return JSON.stringify(
      { mcpServers: { qualio: { type: 'http', url: `${base}/mcp`, headers: { Authorization: `Bearer ${token}` } } } },
      null,
      2,
    );
  }
  return `curl "${base}/tickets?overdue=true" \\n  -H "Authorization: Bearer ${token}"`;
}
