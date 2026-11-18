import { useState } from 'react';

import { Button } from '../../ui';
import { CONNECTION_OPTIONS, connectionSnippet } from './apiTokensLogic';
import type { ConnectionKind } from './apiTokensLogic';

type ConnectGuideProps = {
  apiBaseUrl: string;
  token: string;
  /** Copiar un fragmento con el token cuenta como haberlo copiado. */
  onCopied: () => void;
};

/** Cómo conectar un agente (MCP) o un script (REST) con el token recién creado. */
export function ConnectGuide({ apiBaseUrl, token, onCopied }: ConnectGuideProps) {
  const [kind, setKind] = useState<ConnectionKind>('claude-code');
  const [copiedKind, setCopiedKind] = useState<ConnectionKind | null>(null);
  const option = CONNECTION_OPTIONS.find((item) => item.value === kind) ?? CONNECTION_OPTIONS[0];
  const snippet = connectionSnippet(kind, apiBaseUrl, token);

  const copy = async () => {
    try {
      await window.navigator.clipboard.writeText(snippet);
      setCopiedKind(kind);
      onCopied();
    } catch {
      // Sin portapapeles: el texto se puede seleccionar y copiar a mano.
    }
  };

  return (
    <div className="q-field">
      <span className="q-field__label" id="api-token-connect-label">
        Conecta tu agente
      </span>
      <div className="qat-tabs" role="tablist" aria-labelledby="api-token-connect-label">
        {CONNECTION_OPTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === kind}
            className={`qat-tab${item.value === kind ? ' is-active' : ''}`}
            onClick={() => setKind(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="qat-snippet-wrap" role="tabpanel">
        <pre className="qat-snippet">
          <code>{snippet}</code>
        </pre>
        <Button size="sm" className="qat-snippet-copy" aria-label={`${copiedKind === kind ? 'Copiado' : 'Copiar'}: ${option.label}`} onClick={() => void copy()}>
          {copiedKind === kind ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      <span className="q-field__hint">{option.hint}</span>
    </div>
  );
}
