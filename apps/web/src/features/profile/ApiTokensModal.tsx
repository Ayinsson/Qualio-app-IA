import { useState } from 'react';
import type { FormEvent } from 'react';

import type { ApiToken, ApiTokenExpiration, ApiTokenScope, CreatedApiToken, CreateApiTokenPayload } from '../../lib/apiTokens';
import { Button, EmptyState, Field, fieldDescribedBy, Input, Modal, Select, StatusBadge } from '../../ui';
import {
  EXPIRATION_OPTIONS,
  formatDate,
  formatExpiry,
  formatLastUsed,
  SCOPE_GROUPS,
  scopeLabel,
  sortTokens,
  toggleScope,
  tokenState,
  validateTokenForm,
} from './apiTokensLogic';
import type { TokenFormErrors } from './apiTokensLogic';
import { ConnectGuide } from './ConnectGuide';
import './apiTokens.css';

type ApiTokensModalProps = {
  tokens: ApiToken[] | undefined;
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
  /** Rechaza la promesa si falla; quien llama muestra el aviso. */
  onCreate: (payload: CreateApiTokenPayload) => Promise<CreatedApiToken>;
  onRevoke: (tokenId: string) => Promise<void>;
  onClose: () => void;
  /** URL base del API para el ejemplo de uso. */
  apiBaseUrl: string;
};

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'created'; created: CreatedApiToken };

const DEFAULT_SCOPES: ApiTokenScope[] = ['projects:read', 'tickets:read'];

export function ApiTokensModal({
  tokens,
  loading,
  loadError,
  onRetry,
  onCreate,
  onRevoke,
  onClose,
  apiBaseUrl,
}: ApiTokensModalProps) {
  const [view, setView] = useState<View>({ kind: 'list' });

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiTokenScope[]>(DEFAULT_SCOPES);
  const [expiration, setExpiration] = useState<ApiTokenExpiration>('90d');
  const [errors, setErrors] = useState<TokenFormErrors>({});
  const [creating, setCreating] = useState(false);

  const [copied, setCopied] = useState(false);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const formDirty = view.kind === 'create' && name.trim() !== '';
  const tokenNotCopied = view.kind === 'created' && !copied;

  const resetForm = () => {
    setName('');
    setScopes(DEFAULT_SCOPES);
    setExpiration('90d');
    setErrors({});
  };

  const backToList = () => {
    resetForm();
    setCopied(false);
    setCopyBlocked(false);
    setConfirmingClose(false);
    setView({ kind: 'list' });
  };

  const requestClose = () => {
    if (tokenNotCopied || formDirty) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const nextErrors = validateTokenForm(name, scopes);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate({ name: name.trim(), scopes, expiration });
      resetForm();
      setCopied(false);
      setView({ kind: 'created', created });
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setCreating(false);
    }
  };

  const markCopied = () => {
    setCopied(true);
    setCopyBlocked(false);
    setConfirmingClose(false);
  };

  const copyToken = async (value: string) => {
    try {
      await window.navigator.clipboard.writeText(value);
      markCopied();
      return;
    } catch {
      // Sin permiso de portapapeles: probamos con la selección del campo.
    }
    const field = document.getElementById('api-token-value') as HTMLInputElement | null;
    field?.focus();
    field?.select();
    if (field && document.execCommand('copy')) {
      markCopied();
      return;
    }
    setCopyBlocked(true);
  };

  const revoke = async (tokenId: string) => {
    setRevokingId(tokenId);
    try {
      await onRevoke(tokenId);
      setConfirmRevokeId(null);
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setRevokingId(null);
    }
  };

  const footer = confirmingClose ? (
    <div className="qat-confirm" role="alert">
      <span>{tokenNotCopied ? 'No volveremos a mostrar este token. ¿Ya lo copiaste?' : 'Tienes un token sin crear.'}</span>
      <Button size="sm" onClick={() => setConfirmingClose(false)}>
        {tokenNotCopied ? 'Volver' : 'Seguir editando'}
      </Button>
      <Button size="sm" variant="danger" onClick={onClose}>
        Cerrar igual
      </Button>
    </div>
  ) : view.kind === 'create' ? (
    <>
      <Button onClick={backToList}>Cancelar</Button>
      <Button variant="primary" loading={creating} onClick={() => submit()}>
        Crear token
      </Button>
    </>
  ) : view.kind === 'created' ? (
    <Button
      variant="primary"
      onClick={() => {
        if (!copied) {
          setConfirmingClose(true);
          return;
        }
        backToList();
      }}
    >
      Listo
    </Button>
  ) : (
    <>
      <Button onClick={requestClose}>Cerrar</Button>
      <Button variant="primary" onClick={() => setView({ kind: 'create' })}>
        Nuevo token
      </Button>
    </>
  );

  const title = view.kind === 'create' ? 'Nuevo token de API' : view.kind === 'created' ? 'Token creado' : 'Tokens de API';

  return (
    <Modal open title={title} onClose={requestClose} closeOnBackdrop={!tokenNotCopied && !formDirty} footer={footer}>
      {view.kind === 'list' ? (
        <TokenList
          tokens={tokens}
          loading={loading}
          loadError={loadError}
          onRetry={onRetry}
          confirmRevokeId={confirmRevokeId}
          revokingId={revokingId}
          onAskRevoke={setConfirmRevokeId}
          onRevoke={revoke}
          onCreate={() => setView({ kind: 'create' })}
        />
      ) : null}

      {view.kind === 'create' ? (
        <form className="qat" onSubmit={submit} noValidate>
          <Field
            id="api-token-name"
            label="Nombre"
            hint="Para reconocerlo después. Por ejemplo, el agente o la integración que lo usará."
            error={errors.name}
          >
            <Input
              id="api-token-name"
              value={name}
              maxLength={60}
              placeholder="Claude de mi equipo"
              invalid={Boolean(errors.name)}
              aria-describedby={fieldDescribedBy('api-token-name', 'hint', errors.name)}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
            />
          </Field>

          <fieldset className="qat-scopes" aria-describedby={errors.scopes ? 'api-token-scopes-error' : undefined}>
            <legend className="q-field__label">Permisos</legend>
            <p className="q-field__hint qat-scopes-hint">
              El token actúa en tu nombre, solo sobre tus proyectos y solo con lo que marques aquí.
            </p>
            {SCOPE_GROUPS.map((group) => (
              <div key={group.label} className="qat-scope-row">
                <div className="qat-scope-text">
                  <strong>{group.label}</strong>
                  <span>{group.hint}</span>
                </div>
                <div className="qat-scope-options">
                  {group.options.map(({ scope, label }) => (
                    <label key={scope} className="qat-check">
                      <input
                        type="checkbox"
                        checked={scopes.includes(scope)}
                        onChange={() => {
                          setScopes((current) => toggleScope(current, scope));
                          setErrors((current) => ({ ...current, scopes: undefined }));
                        }}
                        aria-label={`${group.label}: ${label}`}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {errors.scopes ? (
              <span id="api-token-scopes-error" className="q-field__error">
                {errors.scopes}
              </span>
            ) : null}
          </fieldset>

          <Field id="api-token-expiration" label="Vencimiento">
            <Select
              id="api-token-expiration"
              value={expiration}
              onChange={(event) => setExpiration(event.target.value as ApiTokenExpiration)}
            >
              {EXPIRATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      ) : null}

      {view.kind === 'created' ? (
        <div className="qat">
          <p className="qat-warning" role="status">
            Cópialo ahora y guárdalo en un lugar seguro. Por seguridad no lo volveremos a mostrar.
          </p>
          <div className="q-field">
            <label className="q-field__label" htmlFor="api-token-value">
              {view.created.apiToken.name}
            </label>
            <div className="qat-copy">
              <Input
                id="api-token-value"
                readOnly
                value={view.created.token}
                onFocus={(event) => event.currentTarget.select()}
                onCopy={markCopied}
                className="qat-mono"
              />
              <Button variant={copied ? 'secondary' : 'primary'} onClick={() => copyToken(view.created.token)}>
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            {copyBlocked ? (
              <span className="q-field__error" role="alert">
                Tu navegador bloqueó el portapapeles. El token ya está seleccionado: cópialo con Ctrl+C.
              </span>
            ) : null}
            <span className="q-field__hint">
              {view.created.apiToken.scopes.map(scopeLabel).join(' · ')} · {formatExpiry(view.created.apiToken)}
            </span>
          </div>
          <ConnectGuide apiBaseUrl={apiBaseUrl} token={view.created.token} onCopied={markCopied} />
        </div>
      ) : null}
    </Modal>
  );
}

type TokenListProps = {
  tokens: ApiToken[] | undefined;
  loading: boolean;
  loadError: boolean;
  onRetry: () => void;
  confirmRevokeId: string | null;
  revokingId: string | null;
  onAskRevoke: (tokenId: string | null) => void;
  onRevoke: (tokenId: string) => void;
  onCreate: () => void;
};

function TokenList({
  tokens,
  loading,
  loadError,
  onRetry,
  confirmRevokeId,
  revokingId,
  onAskRevoke,
  onRevoke,
  onCreate,
}: TokenListProps) {
  const intro = (
    <p className="qat-intro">
      Conecta agentes de IA o scripts a Qualio para consultar y actualizar proyectos, tickets y evidencias en tu nombre.
    </p>
  );

  if (loading) {
    return (
      <div className="qat">
        {intro}
        <p className="qat-muted" role="status">
          Cargando tokens…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="qat">
        {intro}
        <div className="qat-error" role="alert">
          <span>No pudimos cargar tus tokens.</span>
          <Button size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return (
      <div className="qat">
        {intro}
        <EmptyState
          title="Aún no tienes tokens"
          description="Crea uno para que tu agente pueda consultar tickets abiertos o vencidos, comentarlos y cerrarlos."
          action={
            <Button size="sm" variant="primary" onClick={onCreate}>
              Crear el primero
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="qat">
      {intro}
      <ul className="qat-list">
        {sortTokens(tokens).map((token) => {
          const state = tokenState(token);
          const confirming = confirmRevokeId === token.id;

          return (
            <li key={token.id} className={`qat-item${state === 'active' ? '' : ' is-inactive'}`}>
              <div className="qat-item-head">
                <strong className="qat-item-name">{token.name}</strong>
                {state === 'active' ? null : (
                  <StatusBadge tone={state === 'revoked' ? 'danger' : 'blocked'} label={state === 'revoked' ? 'Revocado' : 'Vencido'} />
                )}
                {state === 'active' && !confirming ? (
                  <Button size="sm" variant="ghost" className="qat-revoke" onClick={() => onAskRevoke(token.id)}>
                    Revocar
                  </Button>
                ) : null}
              </div>
              <code className="qat-mono qat-prefix">{token.tokenPrefix}…</code>
              <ul className="qat-chips" aria-label="Permisos">
                {token.scopes.map((scope) => (
                  <li key={scope}>{scopeLabel(scope)}</li>
                ))}
              </ul>
              <span className="qat-meta">
                Creado el {formatDate(token.createdAt)} · {formatLastUsed(token.lastUsedAt)} · {formatExpiry(token)}
              </span>
              {confirming ? (
                <div className="qat-confirm" role="alert">
                  <span>Lo que use este token dejará de funcionar de inmediato.</span>
                  <Button size="sm" onClick={() => onAskRevoke(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="danger" loading={revokingId === token.id} onClick={() => onRevoke(token.id)}>
                    Revocar token
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
