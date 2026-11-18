import { AsyncLocalStorage } from 'async_hooks';

type RequestContext = {
  /** Token de API con el que se autenticó la petición; ausente en sesiones web. */
  apiTokenId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

/** Middleware de Express: abre un contexto vacío por petición. */
export function requestContextMiddleware(_req: unknown, _res: unknown, next: () => void): void {
  storage.run({}, next);
}

export function setRequestApiTokenId(apiTokenId: string): void {
  const store = storage.getStore();

  if (store) {
    store.apiTokenId = apiTokenId;
  }
}

/** Id del token de API de la petición actual, o null si viene de la web. */
export function currentApiTokenId(): string | null {
  return storage.getStore()?.apiTokenId ?? null;
}
