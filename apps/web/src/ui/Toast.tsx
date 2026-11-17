import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { CloseIcon } from './icons';
import { ToastContext } from './toastContext';
import type { ShowToast, ToastTone } from './toastContext';

type ToastItem = { id: number; message: string; tone: ToastTone };
const TOAST_DURATION_MS = 4500;

function ToastMessage({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`q-toast q-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span className="q-toast__text">{toast.message}</span>
      <button type="button" className="q-icon-btn q-toast__close" onClick={() => onDismiss(toast.id)} aria-label="Cerrar aviso">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}

/** Avisos globales: sobreviven al cambio de vista (por ejemplo, crear un proyecto y abrirlo). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ShowToast>((message, tone = 'success') => {
    setToasts((current) => [...current.slice(-2), { id: Date.now() + Math.random(), message, tone }]);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="q-toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
