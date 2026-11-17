import type { AppNotification } from '../lib/invitations';

export type NotificationFilter = 'ALL' | 'INVITATION' | 'TASK' | 'BUG';

export const NOTIFICATION_FILTERS: Array<{ id: NotificationFilter; label: string }> = [
  { id: 'ALL', label: 'Todo' },
  { id: 'INVITATION', label: 'Invitaciones' },
  { id: 'TASK', label: 'Tareas' },
  { id: 'BUG', label: 'Bugs' },
];

export function notificationActor(notification: AppNotification): string {
  return notification.actorName?.trim() || notification.actorEmail || 'Qualio';
}

export function matchesFilter(notification: AppNotification, filter: NotificationFilter): boolean {
  return filter === 'ALL' || notification.type.startsWith(`${filter}_`);
}

/** Invitación que todavía espera respuesta (muestra Aceptar / Rechazar). */
export function isPendingInvitation(notification: AppNotification): boolean {
  return notification.actionType === 'INVITATION_RESPONSE' && Boolean(notification.actionId);
}

export function groupByDay(
  notifications: AppNotification[],
  now: Date = new Date(),
): Array<{ label: string; items: AppNotification[] }> {
  const formatter = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });
  const todayKey = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = yesterday.toDateString();

  const groups = new Map<string, AppNotification[]>();
  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    const key =
      date.toDateString() === todayKey ? 'Hoy' : date.toDateString() === yesterdayKey ? 'Ayer' : formatter.format(date);
    groups.set(key, [...(groups.get(key) ?? []), notification]);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

/** "hace 5 min", "hace 2 h"; para días anteriores, la hora (el día ya lo da el grupo). */
export function formatNotificationTime(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) {
    return 'ahora';
  }

  if (diffMinutes < 60) {
    return `hace ${diffMinutes} min`;
  }

  if (diffMinutes < 6 * 60 && date.toDateString() === now.toDateString()) {
    return `hace ${Math.round(diffMinutes / 60)} h`;
  }

  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}
