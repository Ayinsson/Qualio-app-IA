import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

import type { Bug } from '../../lib/bugs';
import type { Task } from '../../lib/tasks';
import { CreateTicketModal } from './CreateTicketModal';
import { TicketDetailModal } from './TicketDetailModal';

const members = [
  { projectId: 'p1', userId: 'u-me', role: 'OWNER' as const, name: 'Ayinsson Solano', email: 'a@b.com', avatarUrl: null },
  { projectId: 'p1', userId: 'u-ana', role: 'MEMBER' as const, name: 'Ana Pérez', email: 'ana@b.com', avatarUrl: null },
];

describe('CreateTicketModal', () => {
  it('requires reproduction steps for a bug and sends where it goes', () => {
    const onSubmit = vi.fn();
    render(
      <CreateTicketModal type="bug" members={members} activeSprintName="Sprint 1" submitting={false} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reportar bug' }));
    expect(screen.getByText('Escribe un título de al menos 3 caracteres.')).toBeInTheDocument();
    expect(screen.getByText(/Cuenta cómo reproducirlo/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Pagar no responde' } });
    fireEvent.change(screen.getByLabelText('Pasos para reproducir'), { target: { value: '1. Ir al checkout y pagar' } });
    fireEvent.click(screen.getByLabelText('Alta'));
    fireEvent.click(screen.getByLabelText('Staging'));
    fireEvent.click(screen.getByLabelText('Sprint 1 (en curso)'));
    fireEvent.click(screen.getByRole('button', { name: 'Reportar bug' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pagar no responde', priority: 'HIGH', environment: 'Staging' }),
      [],
      'sprint',
    );
  });

  it('lets a task skip the description and hides the sprint option without an active sprint', () => {
    const onSubmit = vi.fn();
    render(
      <CreateTicketModal type="task" members={members} activeSprintName={null} submitting={false} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    expect(screen.queryByLabelText(/en curso/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Regresión del carrito' } });
    fireEvent.change(screen.getByLabelText(/Responsable/), { target: { value: 'u-ana' } });
    fireEvent.click(screen.getByLabelText('Próximo Sprint'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Regresión del carrito', description: '', assignedTo: 'u-ana', priority: 'MEDIUM' }),
      [],
      'next',
    );
  });
});

const task = {
  id: 't1',
  itemKey: 'ProyectTest-004',
  projectId: 'p1',
  title: 'Matriz de navegadores',
  description: 'Probar Chrome y Safari',
  priority: 'LOW',
  status: 'DONE',
  section: 'SPRINT_BOARD',
  position: 0,
  assignedTo: 'u-me',
  dueDate: '2026-11-18T00:00:00.000Z',
  createdBy: 'u-me',
  createdAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-17T10:00:00.000Z',
} as Task;

function renderDetail(overrides: Partial<Parameters<typeof TicketDetailModal>[0]> = {}) {
  const props = {
    item: { type: 'task' as const, data: task },
    members,
    activeSprintName: 'Sprint 1',
    attachments: [],
    attachmentPreviewUrls: {},
    loadingAttachments: false,
    history: [
      {
        id: 'h1',
        changedBy: 'u-me',
        changedByName: 'Ayinsson Solano',
        changedByEmail: 'a@b.com',
        fieldName: 'assigned_to',
        oldValue: null,
        newValue: 'u-ana',
        changeNote: 'Ana lo revisa',
        createdAt: '2026-11-16T12:00:00.000Z',
      },
    ],
    loadingHistory: false,
    saving: false,
    onSave: vi.fn(),
    onAddAttachments: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<TicketDetailModal {...props} />);
  return props;
}

describe('TicketDetailModal', () => {
  it('shows readable activity, location and an honest save button', () => {
    renderDetail();
    const dialog = screen.getByRole('dialog', { name: 'Tarea ProyectTest-004' });
    const activity = within(dialog).getByRole('region', { name: 'Actividad' });
    expect(within(activity).getByText('Ana Pérez')).toBeInTheDocument();
    expect(within(dialog).getByText('Ana lo revisa')).toBeInTheDocument();
    expect(within(dialog).getByText('Tablero · Sprint 1')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sin cambios' })).toBeDisabled();
  });

  it('asks before discarding unsaved changes, inside the modal', () => {
    const props = renderDetail();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Matriz de navegadores móviles' } });
    // La ✕ del encabezado y el botón del pie cierran igual; usamos el del pie.
    const closeButtons = screen.getAllByRole('button', { name: 'Cerrar' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Tienes cambios sin guardar.');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('warns that reopening returns it to the backlog, and saves the change', () => {
    const props = renderDetail();
    fireEvent.change(screen.getByLabelText(/Estado/), { target: { value: 'TODO' } });
    expect(screen.getByText('Al reabrirlo, el ticket vuelve al backlog general.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task', id: 't1', status: 'TODO', assignedTo: 'u-me', dueDate: '2026-11-18T00:00:00.000Z' }),
    );
  });

  it('shows expected and actual side by side for a bug', () => {
    const bug = {
      ...task,
      id: 'b1',
      status: 'OPEN',
      reportedBy: 'u-me',
      environment: 'Staging',
      expectedResult: 'Se confirma el pedido',
      actualResult: 'Se queda cargando',
    } as unknown as Bug;
    renderDetail({ item: { type: 'bug', data: bug }, history: [] });
    expect(screen.getByLabelText('Resultado esperado')).toHaveValue('Se confirma el pedido');
    expect(screen.getByLabelText('Resultado obtenido')).toHaveValue('Se queda cargando');
    expect(screen.getByText('reportó el bug')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha límite')).toHaveValue('2026-11-18');
  });

  it('lists comments, marks the ones written by an agent, and sends a new one', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    renderDetail({
      onAddComment,
      comments: [
        {
          id: 'c1',
          entityType: 'TASK',
          entityId: 't1',
          projectId: 'p1',
          body: 'Revisé la matriz: falta Firefox.',
          authorId: 'u-me',
          authorName: 'Ayinsson Solano',
          authorEmail: 'a@b.com',
          authorAvatarUrl: null,
          apiTokenId: 'tok-1',
          apiTokenName: 'Claude del equipo',
          createdAt: '2026-11-17T09:00:00.000Z',
        },
      ],
    });
    const comments = screen.getByRole('region', { name: 'Comentarios' });
    expect(within(comments).getByText('Revisé la matriz: falta Firefox.')).toBeInTheDocument();
    expect(within(comments).getByText('vía Claude del equipo')).toBeInTheDocument();

    const send = within(comments).getByRole('button', { name: 'Comentar' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Escribe un comentario'), { target: { value: '  Agregado Firefox  ' } });
    fireEvent.click(send);

    await waitFor(() => expect(onAddComment).toHaveBeenCalledWith('Agregado Firefox'));
    await waitFor(() => expect(screen.getByLabelText('Escribe un comentario')).toHaveValue(''));
  });

  it('marks activity done through an API token', () => {
    renderDetail({
      history: [
        {
          id: 'h2',
          changedBy: 'u-me',
          changedByName: 'Ayinsson Solano',
          changedByEmail: 'a@b.com',
          fieldName: 'status',
          oldValue: 'TODO',
          newValue: 'DONE',
          changeNote: null,
          apiTokenName: 'Claude del equipo',
          createdAt: '2026-11-17T12:00:00.000Z',
        },
      ],
    });
    const activity = screen.getByRole('region', { name: 'Actividad' });
    expect(within(activity).getByText('vía Claude del equipo')).toBeInTheDocument();
  });

  it('hides the comments section when commenting is not wired', () => {
    renderDetail();
    expect(screen.queryByRole('region', { name: 'Comentarios' })).not.toBeInTheDocument();
  });
});
