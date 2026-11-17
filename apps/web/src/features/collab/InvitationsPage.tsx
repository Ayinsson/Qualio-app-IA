import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '../../lib/apiErrors';
import { acceptInvitation, listInvitationNotifications, rejectInvitation } from '../../lib/invitations';
import type { AppNotification } from '../../lib/invitations';
import { Avatar, Button, Card, EmptyState, MailIcon, useToast } from '../../ui';
import { formatRelative, invitationActor, invitationProjectName, splitInvitations } from './collabLogic';
import './collab.css';

type Tab = 'pending' | 'history';

const PAGE = 40;

export function InvitationsPage() {
  const accessToken = localStorage.getItem('qualio_access_token') ?? '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('pending');
  const [limit, setLimit] = useState(PAGE);
  const [rejecting, setRejecting] = useState<string | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ['invitation-notifications', accessToken, limit, 'view'],
    queryFn: () => listInvitationNotifications(accessToken, { limit, offset: 0 }),
    enabled: Boolean(accessToken),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['invitation-notifications', accessToken] });

  const acceptMutation = useMutation({
    mutationFn: (notification: AppNotification) => acceptInvitation(accessToken, notification.actionId as string),
    onSuccess: (_result, notification) => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast(`Ya participas en ${invitationProjectName(notification)}.`);
      if (notification.projectId) {
        navigate(`/app/proyectos/${notification.projectId}`);
      }
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (notification: AppNotification) => rejectInvitation(accessToken, notification.actionId as string),
    onSuccess: (_result, notification) => {
      setRejecting(null);
      refresh();
      toast(`Rechazaste la invitación a ${invitationProjectName(notification)}.`);
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const all = notificationsQuery.data ?? [];
  const { pending, history } = splitInvitations(all);
  const busy = acceptMutation.isPending || rejectMutation.isPending;
  const items = tab === 'pending' ? pending : history;

  return (
    <section className="qc6-page">
      <header className="qc6-page-header">
        <h1 className="qc6-page-title">Invitaciones</h1>
        <p className="qc6-page-subtitle">Únete a los proyectos a los que te invitan y sigue las respuestas a las tuyas.</p>
      </header>

      <div className="qc6-tabs" role="tablist" aria-label="Invitaciones">
        {(
          [
            ['pending', 'Pendientes', pending.length],
            ['history', 'Historial', history.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`inv-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="inv-panel"
            className={`qc6-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            {notificationsQuery.isSuccess ? <span className="qc6-tab-count">{count}</span> : null}
          </button>
        ))}
      </div>

      <div id="inv-panel" role="tabpanel" aria-labelledby={`inv-tab-${tab}`}>
        {notificationsQuery.isPending && accessToken ? <p className="qc6-note">Cargando invitaciones…</p> : null}

        {notificationsQuery.isError ? (
          <Card>
            <EmptyState
              title="No pudimos cargar tus invitaciones"
              description={getApiErrorMessage(notificationsQuery.error)}
              action={<Button onClick={() => notificationsQuery.refetch()}>Reintentar</Button>}
            />
          </Card>
        ) : null}

        {notificationsQuery.isSuccess && items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MailIcon size={22} />}
              title={tab === 'pending' ? 'No tienes invitaciones pendientes' : 'Aún no hay respuestas'}
              description={
                tab === 'pending'
                  ? 'Cuando alguien te invite a un proyecto, aparecerá aquí para que decidas.'
                  : 'Cuando alguien acepte o rechace una invitación tuya, lo verás aquí.'
              }
            />
          </Card>
        ) : null}

        {items.length > 0 ? (
          <ul className="qc6-cards">
            {items.map((notification) => {
              const actor = invitationActor(notification);
              const project = invitationProjectName(notification);

              if (tab === 'history') {
                const accepted = notification.type === 'INVITATION_ACCEPTED';
                return (
                  <li key={notification.id} className="qc6-card">
                    <Avatar name={actor} src={notification.actorAvatarUrl} size={36} />
                    <p className="qc6-card-text">
                      <strong>{actor}</strong> {notification.message.replace(actor, '').trim() || (accepted ? 'aceptó tu invitación.' : 'rechazó tu invitación.')}
                      <time dateTime={notification.createdAt}>{formatRelative(notification.createdAt)}</time>
                    </p>
                    <span className={`qc6-outcome ${accepted ? 'is-accepted' : 'is-rejected'}`}>
                      {accepted ? 'Aceptada' : 'Rechazada'}
                    </span>
                  </li>
                );
              }

              const confirming = rejecting === notification.id;
              return (
                <li key={notification.id} className={`qc6-card${notification.isRead ? '' : ' is-unread'}`}>
                  <Avatar name={actor} src={notification.actorAvatarUrl} size={36} />
                  <p className="qc6-card-text">
                    <strong>{actor}</strong> te invitó a <strong>{project}</strong>
                    <time dateTime={notification.createdAt}>{formatRelative(notification.createdAt)}</time>
                  </p>
                  {confirming ? (
                    <div className="qc6-confirm" role="alert">
                      <span>¿Rechazar? Tendrían que invitarte de nuevo.</span>
                      <Button size="sm" onClick={() => setRejecting(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={rejectMutation.isPending && rejectMutation.variables?.id === notification.id}
                        onClick={() => rejectMutation.mutate(notification)}
                      >
                        Rechazar
                      </Button>
                    </div>
                  ) : (
                    <span className="qc6-card-actions">
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(notification.id)}>
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy && !(acceptMutation.variables?.id === notification.id)}
                        loading={acceptMutation.isPending && acceptMutation.variables?.id === notification.id}
                        onClick={() => acceptMutation.mutate(notification)}
                      >
                        Aceptar y abrir
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        {all.length >= limit ? (
          <div className="qc6-more">
            <Button size="sm" loading={notificationsQuery.isFetching} onClick={() => setLimit((value) => value + PAGE)}>
              Cargar más
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
