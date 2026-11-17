import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

import { CloseIcon } from './icons';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** Contenido junto al título (por ejemplo, el estado de un ticket). */
  aside?: ReactNode;
  /** Cerrar al hacer clic fuera. Desactívalo en formularios con cambios sin guardar. */
  closeOnBackdrop?: boolean;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  aside,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Guardamos onClose en una ref: quien usa el modal suele pasar una función nueva en cada
  // render, y si el efecto dependiera de ella, el foco volvería al primer campo con cada tecla.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.q-modal__close), [href], [tabindex]:not([tabindex="-1"])',
    );
    (firstFocusable ?? dialogRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="q-modal-backdrop"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={`q-modal${size === 'lg' ? ' q-modal--lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="q-modal__head">
          <h2 id={titleId} className="q-modal__title">
            {title}
          </h2>
          {aside ? <div className="q-modal__aside">{aside}</div> : null}
          <button type="button" className="q-icon-btn q-modal__close" onClick={onClose} aria-label="Cerrar">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="q-modal__body">{children}</div>
        {footer ? <div className="q-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
