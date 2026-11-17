import type { AppNotification } from '../../lib/invitations';
import type { Project } from '../../lib/projects';

/** "ahora", "hace 5 min", "hace 2 h", "ayer", "hace 3 días" o la fecha. */
export function formatRelative(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);

  if (minutes < 1) {
    return 'ahora';
  }
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }
  if (minutes < 24 * 60) {
    return `hace ${Math.round(minutes / 60)} h`;
  }

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (days <= 1) {
    return 'ayer';
  }
  if (days < 7) {
    return `hace ${days} días`;
  }

  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date);
}

/** La API titula las invitaciones "Invitación a <proyecto>". */
export function invitationProjectName(notification: AppNotification): string {
  const match = /^Invitaci[oó]n a (.+)$/.exec(notification.title.trim());
  return match ? match[1] : notification.title;
}

export function invitationActor(notification: AppNotification): string {
  return notification.actorName?.trim() || notification.actorEmail || 'Alguien';
}

export type InvitationGroups = {
  /** Invitaciones que esperan tu respuesta. */
  pending: AppNotification[];
  /** Respuestas a las invitaciones que tú enviaste. */
  history: AppNotification[];
};

export function splitInvitations(notifications: AppNotification[]): InvitationGroups {
  return {
    pending: notifications.filter(
      (item) => item.type === 'INVITATION_PENDING' && item.actionType === 'INVITATION_RESPONSE' && Boolean(item.actionId),
    ),
    history: notifications.filter((item) => item.type === 'INVITATION_ACCEPTED' || item.type === 'INVITATION_REJECTED'),
  };
}

/** Proyectos activos que otra persona creó y en los que participas. */
export function sharedWithMe(projects: Project[], currentUserId: string | null): Project[] {
  if (!currentUserId) {
    return [];
  }
  return projects.filter((project) => project.ownerId !== currentUserId);
}
