import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import type { AppNotification, ProjectPendingInvitation } from '../../lib/invitations';
import type { Project } from '../../lib/projects';
import { formatRelative, invitationProjectName, sharedWithMe, splitInvitations } from './collabLogic';
import { MembersModal } from './MembersModal';

const now = new Date('2026-11-17T15:00:00');

function notification(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1',
    userId: 'u-me',
    type: 'INVITATION_PENDING',
    title: 'Invitación a Tienda Norte',
    message: 'Ana Pérez te invitó como MEMBER.',
    projectId: 'p1',
    entityType: 'INVITATION',
    entityId: 'i1',
    actionType: 'INVITATION_RESPONSE',
    actionId: 'i1',
    isRead: false,
    createdAt: '2026-11-17T13:00:00',
    readAt: null,
    actorUserId: 'u-ana',
    actorName: 'Ana Pérez',
    actorEmail: 'ana@b.com',
    actorAvatarUrl: null,
    ...overrides,
  };
}

describe('collabLogic', () => {
  it('describes times in plain words', () => {
    expect(formatRelative('2026-11-17T14:59:40', now)).toBe('ahora');
    expect(formatRelative('2026-11-17T14:20:00', now)).toBe('hace 40 min');
    expect(formatRelative('2026-11-17T12:00:00', now)).toBe('hace 3 h');
    expect(formatRelative('2026-11-16T09:00:00', now)).toBe('ayer');
    expect(formatRelative('2026-11-13T09:00:00', now)).toBe('hace 4 días');
  });

  it('separates invitations waiting for you from answers to yours', () => {
    const groups = splitInvitations([
      notification({ id: 'a' }),
      notification({ id: 'b', type: 'INVITATION_ACCEPTED', actionType: null, actionId: null }),
      notification({ id: 'c', type: 'TASK_CREATED', actionType: null }),
    ]);
    expect(groups.pending.map((item) => item.id)).toEqual(['a']);
    expect(groups.history.map((item) => item.id)).toEqual(['b']);
    expect(invitationProjectName(notification({}))).toBe('Tienda Norte');
  });

  it('lists only projects someone else owns', () => {
    const projects = [{ id: '1', ownerId: 'u-me' }, { id: '2', ownerId: 'u-ana' }] as Project[];
    expect(sharedWithMe(projects, 'u-me').map((project) => project.id)).toEqual(['2']);
    expect(sharedWithMe(projects, null)).toEqual([]);
  });
});

const members = [
  { projectId: 'p1', userId: 'u-me', role: 'OWNER' as const, name: 'Ayinsson Solano', email: 'a@b.com', avatarUrl: null },
  { projectId: 'p1', userId: 'u-ana', role: 'MEMBER' as const, name: 'Ana Pérez', email: 'ana@b.com', avatarUrl: null },
];

const pending: ProjectPendingInvitation[] = [
  {
    id: 'i1',
    projectId: 'p1',
    projectName: 'Tienda Norte',
    inviterUserId: 'u-me',
    inviterName: 'Ayinsson Solano',
    inviterEmail: 'a@b.com',
    invitedEmail: 'luis@b.com',
    role: 'MEMBER',
    status: 'PENDING',
    isRead: false,
    createdAt: new Date().toISOString(),
    respondedAt: null,
  },
];

function renderModal(overrides: Partial<Parameters<typeof MembersModal>[0]> = {}) {
  const props = {
    projectName: 'Tienda Norte',
    members,
    pendingInvitations: pending,
    loadingPending: false,
    isOwner: true,
    currentUserId: 'u-me',
    inviting: false,
    removingUserId: null,
    cancellingInvitationId: null,
    onInvite: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn(),
    onCancelInvitation: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<MembersModal {...props} />);
  return props;
}

describe('MembersModal', () => {
  it('invites by email without asking for a role, and catches repeats', async () => {
    const props = renderModal();
    expect(screen.queryByLabelText(/Rol/)).not.toBeInTheDocument();

    const input = screen.getByLabelText('Invitar por correo');
    fireEvent.change(input, { target: { value: 'ana@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invitar' }));
    expect(screen.getByText('Esa persona ya participa en el proyecto.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: ' Nuevo@B.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invitar' }));
    expect(props.onInvite).toHaveBeenCalledWith('nuevo@b.com');
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('confirms before removing someone', () => {
    const props = renderModal();
    expect(screen.getByText('Tú')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('¿Quitar a Ana Pérez? Ya no verá el proyecto.');
    expect(props.onRemove).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole('button', { name: 'Quitar' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(props.onRemove).toHaveBeenCalledWith('u-ana');
  });

  it('lets the owner cancel a pending invitation', () => {
    const props = renderModal();
    expect(screen.getByText('luis@b.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar invitación' }));
    expect(props.onCancelInvitation).toHaveBeenCalledWith('i1');
  });

  it('shows members read-only to someone who is not the owner', () => {
    renderModal({ isOwner: false, currentUserId: 'u-ana' });
    expect(screen.queryByLabelText('Invitar por correo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    expect(screen.queryByText('luis@b.com')).not.toBeInTheDocument();
    expect(screen.getByText(/Solo Ayinsson Solano puede invitar/)).toBeInTheDocument();
  });
});
