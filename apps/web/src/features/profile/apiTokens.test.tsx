import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import type { ApiToken } from '../../lib/apiTokens';
import { ApiTokensModal } from './ApiTokensModal';
import { connectionSnippet, formatLastUsed, sortTokens, toggleScope, tokenState, validateTokenForm } from './apiTokensLogic';

const NOW = new Date('2026-11-17T12:00:00Z').getTime();

function token(overrides: Partial<ApiToken> = {}): ApiToken {
  return {
    id: 'token-1',
    name: 'Claude del equipo',
    tokenPrefix: 'qlo_abcd1234',
    scopes: ['tickets:read'],
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: '2026-11-01T12:00:00Z',
    ...overrides,
  };
}

describe('apiTokensLogic', () => {
  it('checking write also checks read, and unchecking read also unchecks write', () => {
    expect(toggleScope([], 'tickets:write')).toEqual(['tickets:read', 'tickets:write']);
    expect(toggleScope(['tickets:read', 'tickets:write'], 'tickets:read')).toEqual([]);
    expect(toggleScope(['tickets:read', 'tickets:write'], 'tickets:write')).toEqual(['tickets:read']);
    expect(toggleScope([], 'comments:write')).toEqual(['tickets:read', 'comments:write']);
    expect(toggleScope(['tickets:read', 'comments:write', 'tickets:write'], 'tickets:read')).toEqual([]);
  });

  it('validates name and scopes', () => {
    expect(validateTokenForm(' ', [])).toEqual({
      name: expect.stringContaining('Ponle un nombre'),
      scopes: 'Elige al menos un permiso.',
    });
    expect(validateTokenForm('A', ['tickets:read']).name).toBe('Usa al menos 2 caracteres.');
    expect(validateTokenForm('Mi agente', ['tickets:read'])).toEqual({});
  });

  it('knows when a token is active, expired or revoked and lists active ones first', () => {
    const expired = token({ id: 'expired', expiresAt: '2026-11-10T00:00:00Z', createdAt: '2026-11-15T00:00:00Z' });
    const revoked = token({ id: 'revoked', revokedAt: '2026-11-16T00:00:00Z' });
    const active = token({ id: 'active', expiresAt: '2027-01-01T00:00:00Z' });

    expect(tokenState(expired, NOW)).toBe('expired');
    expect(tokenState(revoked, NOW)).toBe('revoked');
    expect(tokenState(active, NOW)).toBe('active');
    expect(sortTokens([expired, revoked, active], NOW)[0].id).toBe('active');
  });

  it('builds ready-to-paste connection snippets with the full token', () => {
    expect(connectionSnippet('claude-code', 'https://api.qualio.app/', 'qlo_abc')).toBe(
      'claude mcp add --transport http qualio https://api.qualio.app/mcp --header "Authorization: Bearer qlo_abc"',
    );
    expect(JSON.parse(connectionSnippet('mcp-json', 'http://localhost:3000', 'qlo_abc'))).toEqual({
      mcpServers: { qualio: { type: 'http', url: 'http://localhost:3000/mcp', headers: { Authorization: 'Bearer qlo_abc' } } },
    });
    expect(connectionSnippet('rest', 'http://localhost:3000', 'qlo_abc')).toContain('/tickets?overdue=true');
  });

  it('describes the last use in plain words', () => {
    expect(formatLastUsed(null, NOW)).toBe('Nunca usado');
    expect(formatLastUsed('2026-11-17T11:30:00Z', NOW)).toBe('Usado hace 30 min');
    expect(formatLastUsed('2026-11-16T11:00:00Z', NOW)).toBe('Usado ayer');
  });
});

function renderModal(tokens: ApiToken[] = []) {
  const props = {
    tokens,
    loading: false,
    loadError: false,
    onRetry: vi.fn(),
    onCreate: vi.fn().mockResolvedValue({
      token: 'qlo_secretvalue',
      apiToken: token({ id: 'new', name: 'Mi agente', scopes: ['projects:read', 'tickets:read'] }),
    }),
    onRevoke: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    apiBaseUrl: 'http://localhost:3000',
  };
  render(<ApiTokensModal {...props} />);
  return props;
}

describe('ApiTokensModal', () => {
  it('invites to create the first token when there are none', () => {
    renderModal();
    expect(screen.getByText('Aún no tienes tokens')).toBeInTheDocument();
  });

  it('creates a token with the chosen scopes and shows its value once', async () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo token' }));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Mi agente ' } });
    fireEvent.click(screen.getByLabelText('Tickets: Crear y editar'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear token' }));

    await waitFor(() =>
      expect(props.onCreate).toHaveBeenCalledWith({
        name: 'Mi agente',
        scopes: ['projects:read', 'tickets:read', 'tickets:write'],
        expiration: '90d',
      }),
    );
    expect(await screen.findByDisplayValue('qlo_secretvalue')).toBeInTheDocument();
    expect(screen.getByText(/no lo volveremos a mostrar/)).toBeInTheDocument();
  });

  it('does not submit without a name', () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo token' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear token' }));

    expect(props.onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/Ponle un nombre/)).toBeInTheDocument();
  });

  it('warns before closing if the new token was not copied', async () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo token' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mi agente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear token' }));
    await screen.findByDisplayValue('qlo_secretvalue');

    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.getByText(/¿Ya lo copiaste\?/)).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('copies the token to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(window.navigator, { clipboard: { writeText } });
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo token' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mi agente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear token' }));
    await screen.findByDisplayValue('qlo_secretvalue');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('qlo_secretvalue');
  });

  it('shows how to connect an agent and counts copying the command as copying the token', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(window.navigator, { clipboard: { writeText } });
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo token' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mi agente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear token' }));
    await screen.findByDisplayValue('qlo_secretvalue');

    expect(screen.getByText(/claude mcp add --transport http qualio http:\/\/localhost:3000\/mcp/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Otros agentes (MCP)' }));
    expect(screen.getByText(/"mcpServers"/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copiar: Otros agentes (MCP)' }));
    await screen.findByRole('button', { name: 'Copiado: Otros agentes (MCP)' });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Bearer qlo_secretvalue'));

    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(/¿Ya lo copiaste\?/)).not.toBeInTheDocument();
  });

  it('asks for confirmation before revoking', async () => {
    const props = renderModal([token()]);
    expect(screen.getByText('qlo_abcd1234…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }));
    expect(props.onRevoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Revocar token' }));

    await waitFor(() => expect(props.onRevoke).toHaveBeenCalledWith('token-1'));
  });

  it('does not offer to revoke tokens that are already revoked', () => {
    renderModal([token({ revokedAt: '2026-11-16T00:00:00Z' })]);
    expect(screen.getByText('Revocado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revocar' })).not.toBeInTheDocument();
  });
});
