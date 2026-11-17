import type { AppNotification } from '../lib/invitations';
import { getBreadcrumb, normalizeSearch, searchDestinations } from './navigation';
import { formatNotificationTime, groupByDay, isPendingInvitation } from './notifications';

const projects = [
  { id: 'p1', name: 'Checkout Web', logoUrl: null },
  { id: 'p2', name: 'Operación móvil', logoUrl: null },
];

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1',
    userId: 'u1',
    type: 'TASK_CREATED',
    title: 'Nueva tarea',
    message: 'TSK-1 fue creada.',
    projectId: null,
    entityType: null,
    entityId: null,
    actionType: null,
    actionId: null,
    isRead: false,
    createdAt: '2026-11-16T10:00:00.000Z',
    ...overrides,
  } as AppNotification;
}

describe('getBreadcrumb', () => {
  it('names the current project from the sidebar data', () => {
    expect(getBreadcrumb('/app/proyectos/p1', projects)).toEqual([
      { label: 'Proyectos', to: '/app/proyectos/activos' },
      { label: 'Checkout Web' },
    ]);
  });

  it('falls back to a generic label while projects load', () => {
    expect(getBreadcrumb('/app/proyectos/p9', [])[1]).toEqual({ label: 'Proyecto' });
  });

  it('maps known sections', () => {
    expect(getBreadcrumb('/app/dashboard', projects)).toEqual([{ label: 'Inicio' }]);
    expect(getBreadcrumb('/app/colaborar/invitaciones', projects)[1].label).toBe('Invitaciones');
  });
});

describe('searchDestinations', () => {
  it('ignores accents and case', () => {
    expect(normalizeSearch('  Operación ')).toBe('operacion');
    expect(searchDestinations('operacion', projects).map((item) => item.label)).toEqual(['Operación móvil']);
  });

  it('finds sections as well as projects', () => {
    expect(searchDestinations('archiv', projects).map((item) => item.to)).toEqual(['/app/proyectos/archivados']);
  });

  it('shows projects first and every section when the query is empty', () => {
    const results = searchDestinations('', projects);
    expect(results[0].group).toBe('Proyectos');
    expect(results.filter((item) => item.group === 'Ir a')).toHaveLength(6);
  });
});

describe('notifications', () => {
  const now = new Date('2026-11-16T12:00:00');

  it('groups by today, yesterday and older dates', () => {
    const groups = groupByDay(
      [
        notification({ id: 'a', createdAt: new Date('2026-11-16T09:00:00').toISOString() }),
        notification({ id: 'b', createdAt: new Date('2026-11-15T09:00:00').toISOString() }),
        notification({ id: 'c', createdAt: new Date('2026-11-02T09:00:00').toISOString() }),
      ],
      now,
    );
    expect(groups.map((group) => group.label)).toEqual(['Hoy', 'Ayer', '2 de noviembre']);
  });

  it('uses relative times for recent items', () => {
    expect(formatNotificationTime(new Date('2026-11-16T11:55:00').toISOString(), now)).toBe('hace 5 min');
    expect(formatNotificationTime(new Date('2026-11-16T10:00:00').toISOString(), now)).toBe('hace 2 h');
  });

  it('detects invitations that still need an answer', () => {
    expect(isPendingInvitation(notification({ actionType: 'INVITATION_RESPONSE', actionId: 'inv-1' }))).toBe(true);
    expect(isPendingInvitation(notification({ actionType: null }))).toBe(false);
  });
});
