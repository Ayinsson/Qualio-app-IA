import { useEffect, useRef } from 'react';

import type { AppNotification } from '../lib/invitations';
import { Avatar, BellIcon, Button, CloseIcon, EmptyState } from '../ui';
import {
  formatNotificationTime,
  groupByDay,
  isPendingInvitation,
  matchesFilter,
  NOTIFICATION_FILTERS,
  notificationActor,
} from './notifications';
import type { NotificationFilter } from './notifications';

export type BrowserAlertsState = 'unsupported' | 'default' | 'granted' | 'denied';

type NotificationsPanelProps = {
  open: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  loading: boolean;
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  unreadCount: number;
  onMarkAllRead: () => void;
  markingAllRead: boolean;
  onAccept: (invitationId: string) => void;
  onReject: (invitationId: string) => void;
  responding: boolean;
  canLoadMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  browserAlerts: BrowserAlertsState;
  onEnableBrowserAlerts: () => void;
};

export function NotificationsPanel({
  open,
  onClose,
  notifications,
  loading,
  filter,
  onFilterChange,
  unreadCount,
  onMarkAllRead,
  markingAllRead,
  onAccept,
  onReject,
  responding,
  canLoadMore,
  loadingMore,
  onLoadMore,
  browserAlerts,
  onEnableBrowserAlerts,
}: NotificationsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  const counts = Object.fromEntries(
    NOTIFICATION_FILTERS.map(({ id }) => [id, notifications.filter((item) => matchesFilter(item, id)).length]),
  ) as Record<NotificationFilter, number>;
  const groups = groupByDay(notifications.filter((item) => matchesFilter(item, filter)));
  const activeLabel = NOTIFICATION_FILTERS.find((item) => item.id === filter)?.label.toLowerCase() ?? '';

  return (
    <>
      {open ? <div className="ql-panel-backdrop" onClick={onClose} aria-hidden="true" /> : null}
      <aside
        ref={panelRef}
        className={`ql-notifications${open ? ' is-open' : ''}`}
        aria-label="Notificaciones"
        aria-hidden={!open}
        tabIndex={-1}
        inert={!open}
      >
        <header className="ql-notifications-head">
          <h2>Notificaciones</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            loading={markingAllRead}
          >
            Marcar todo leído
          </Button>
          <button type="button" className="q-icon-btn" onClick={onClose} aria-label="Cerrar notificaciones">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="ql-tabs" role="tablist" aria-label="Filtrar notificaciones">
          {NOTIFICATION_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className="ql-tab"
              onClick={() => onFilterChange(id)}
            >
              {label}
              <span className="ql-tab-count">{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="ql-notifications-list">
          {loading ? <p className="ql-notifications-note">Cargando notificaciones…</p> : null}

          {!loading && groups.length === 0 ? (
            <EmptyState
              icon={<BellIcon size={22} />}
              title={filter === 'ALL' ? 'Estás al día' : `Sin notificaciones de ${activeLabel}`}
              description="Aquí verás invitaciones a proyectos y cambios en tareas y bugs."
            />
          ) : null}

          {groups.map((group) => (
            <section key={group.label} className="ql-notif-group" aria-label={group.label}>
              <h3 className="ql-notif-day">{group.label}</h3>
              {group.items.map((notification) => {
                const actor = notificationActor(notification);
                return (
                  <article key={notification.id} className={`ql-notif${notification.isRead ? '' : ' is-unread'}`}>
                    <Avatar name={actor} src={notification.actorAvatarUrl} size={32} />
                    <div className="ql-notif-body">
                      <p className="ql-notif-title">
                        {!notification.isRead ? <span className="sr-only">Sin leer: </span> : null}
                        {notification.title}
                      </p>
                      <p className="ql-notif-message">{notification.message}</p>
                      <p className="ql-notif-meta">
                        {actor} · <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
                      </p>
                      {isPendingInvitation(notification) ? (
                        <div className="ql-notif-actions">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={responding}
                            onClick={() => onAccept(notification.actionId as string)}
                          >
                            Aceptar
                          </Button>
                          <Button size="sm" disabled={responding} onClick={() => onReject(notification.actionId as string)}>
                            Rechazar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ))}

          {canLoadMore && filter === 'ALL' ? (
            <div className="ql-notifications-more">
              <Button size="sm" onClick={onLoadMore} loading={loadingMore}>
                {loadingMore ? 'Cargando…' : 'Cargar anteriores'}
              </Button>
            </div>
          ) : null}
        </div>

        {browserAlerts === 'default' ? (
          <footer className="ql-notifications-foot">
            <p>¿Quieres un aviso cuando llegue algo y no estés en Qualio?</p>
            <Button size="sm" onClick={onEnableBrowserAlerts}>
              Activar avisos del navegador
            </Button>
          </footer>
        ) : null}
        {browserAlerts === 'denied' ? (
          <footer className="ql-notifications-foot">
            <p>Los avisos del navegador están bloqueados. Puedes activarlos desde la configuración del sitio.</p>
          </footer>
        ) : null}
      </aside>
    </>
  );
}
