import type { ReactNode } from 'react';

import { InboxIcon } from './icons';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  /**
   * Ilustración a color en lugar del ícono. Resérvala para momentos importantes
   * (proyecto nuevo, sin sprint, todo al día) para que siga sintiéndose especial.
   */
  illustrated?: boolean;
  /** Acción que invita a empezar, por ejemplo "Crear tarea". */
  action?: ReactNode;
};

/** Un estado vacío es una invitación a actuar, no una disculpa. */
export function EmptyState({ title, description, icon, illustrated = false, action }: EmptyStateProps) {
  return (
    <div className={`q-empty${illustrated ? ' q-empty--illustrated' : ''}`}>
      {illustrated ? (
        <span className="q-empty__art" aria-hidden="true">
          {/* Las dos versiones se cargan solo cuando se muestran; el tema decide cuál. */}
          <img className="q-empty__art-light" src="/empty-clipboard-light.webp" alt="" width={320} height={167} loading="lazy" decoding="async" />
          <img className="q-empty__art-dark" src="/empty-clipboard-dark.webp" alt="" width={320} height={167} loading="lazy" decoding="async" />
        </span>
      ) : (
        <span className="q-empty__icon" aria-hidden="true">
          {icon ?? <InboxIcon size={22} />}
        </span>
      )}
      <h3 className="q-empty__title">{title}</h3>
      {description ? <p className="q-empty__text">{description}</p> : null}
      {action ? <div className="q-empty__action">{action}</div> : null}
    </div>
  );
}
