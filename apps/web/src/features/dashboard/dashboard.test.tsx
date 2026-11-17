import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import type { Bug } from '../../lib/bugs';
import type { Task } from '../../lib/tasks';
import { assignedTasks, buildSummary, describeDue, firstName, greeting, urgentBugs } from './dashboardLogic';
import type { WithProject } from './dashboardLogic';
import { DashboardView } from './DashboardView';

vi.mock('../../lib/projects', () => ({
  listProjects: vi.fn(),
}));
vi.mock('../../lib/sprints', () => ({ getActiveSprint: vi.fn() }));
vi.mock('../../lib/tasks', () => ({ listTasks: vi.fn() }));
vi.mock('../../lib/bugs', () => ({ listBugs: vi.fn() }));

const project = { id: 'p1', name: 'Checkout Web' };
const NOW = new Date(2026, 10, 16, 15, 0);

function task(overrides: Partial<Task>): WithProject<Task> {
  return {
    id: 't1',
    itemKey: 'TSK-1',
    projectId: 'p1',
    title: 'Tarea',
    description: null,
    priority: 'MEDIUM',
    status: 'TODO',
    section: 'GENERAL_BACKLOG',
    position: 0,
    assignedTo: 'me',
    dueDate: null,
    createdBy: 'me',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    project,
    ...overrides,
  } as WithProject<Task>;
}

function bug(overrides: Partial<Bug>): WithProject<Bug> {
  return {
    id: 'b1',
    itemKey: 'BUG-1',
    projectId: 'p1',
    title: 'Bug',
    description: '',
    priority: 'HIGH',
    status: 'OPEN',
    section: 'GENERAL_BACKLOG',
    position: 0,
    reportedBy: 'me',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    project,
    ...overrides,
  } as WithProject<Bug>;
}

describe('dashboard logic', () => {
  it('greets by time of day and uses the first name', () => {
    expect(greeting(new Date(2026, 10, 16, 9))).toBe('Buenos días');
    expect(greeting(new Date(2026, 10, 16, 15))).toBe('Buenas tardes');
    expect(greeting(new Date(2026, 10, 16, 21))).toBe('Buenas noches');
    expect(firstName('Ayinsson Solano', 'a@b.com')).toBe('Ayinsson');
    expect(firstName(null, 'luis.perez@empresa.com')).toBe('luis.perez');
  });

  it('describes due dates as local calendar days', () => {
    expect(describeDue('2026-11-15', NOW)?.tone).toBe('late');
    expect(describeDue('2026-11-16', NOW)).toEqual({ label: 'Vence hoy', tone: 'late' });
    expect(describeDue('2026-11-17', NOW)).toEqual({ label: 'Vence mañana', tone: 'soon' });
    expect(describeDue(null, NOW)).toBeNull();
    // La API manda medianoche UTC: no debe correrse al día anterior en UTC−5.
    expect(describeDue('2026-11-16T00:00:00.000Z', NOW)).toEqual({ label: 'Vence hoy', tone: 'late' });
  });

  it('keeps only my unfinished tasks, by priority then due date', () => {
    const result = assignedTasks(
      [
        task({ id: 'low', priority: 'LOW' }),
        task({ id: 'done', status: 'DONE', priority: 'HIGH' }),
        task({ id: 'other', assignedTo: 'someone', priority: 'HIGH' }),
        task({ id: 'high-late', priority: 'HIGH', dueDate: '2026-11-20' }),
        task({ id: 'high-soon', priority: 'HIGH', dueDate: '2026-11-17' }),
      ],
      'me',
    );
    expect(result.map((item) => item.id)).toEqual(['high-soon', 'high-late', 'low']);
  });

  it('keeps only open high-priority bugs', () => {
    const result = urgentBugs([
      bug({ id: 'a' }),
      bug({ id: 'b', status: 'RESOLVED' }),
      bug({ id: 'c', priority: 'LOW' }),
      bug({ id: 'd', status: 'IN_PROGRESS' }),
    ]);
    expect(result.map((item) => item.id).sort()).toEqual(['a', 'd']);
  });

  it('writes a one-sentence summary', () => {
    const text = (parts: ReturnType<typeof buildSummary>) => parts.map((part) => part.text).join('');
    expect(text(buildSummary([], [], NOW))).toBe(
      'No tienes tareas pendientes asignadas. No hay bugs de prioridad alta abiertos.',
    );
    expect(text(buildSummary([task({ dueDate: '2026-11-16' }), task({ id: 't2' })], [bug({})], NOW))).toBe(
      'Tienes 2 tareas asignadas, 1 vence hoy o está vencida. Hay 1 bug de prioridad alta abierto en Checkout Web.',
    );
  });
});

describe('DashboardView', () => {
  async function renderWith(projects: unknown[], tasks: unknown[] = [], bugs: unknown[] = []) {
    const projectsLib = await import('../../lib/projects');
    const sprintsLib = await import('../../lib/sprints');
    const tasksLib = await import('../../lib/tasks');
    const bugsLib = await import('../../lib/bugs');
    vi.mocked(projectsLib.listProjects).mockResolvedValue(projects as never);
    vi.mocked(sprintsLib.getActiveSprint).mockResolvedValue({ id: 's4', name: 'Sprint 4' } as never);
    vi.mocked(tasksLib.listTasks).mockResolvedValue(tasks as never);
    vi.mocked(bugsLib.listBugs).mockResolvedValue(bugs as never);
    localStorage.setItem('qualio_access_token', 'token');

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DashboardView user={{ id: 'me', name: 'Ayinsson Solano', email: 'a@b.com' }} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('invites to create the first project when there are none', async () => {
    await renderWith([]);
    expect(await screen.findByRole('heading', { name: 'Crea tu primer proyecto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo proyecto' })).toBeInTheDocument();
  });

  it('shows my tasks, urgent bugs and project progress from real data', async () => {
    const projectRow = { id: 'p1', name: 'Checkout Web', logoUrl: null };
    await renderWith(
      [projectRow],
      [{ ...task({ title: 'Casos de devoluciones', section: 'SPRINT_BOARD', sprintId: 's4' }), project: undefined }],
      [{ ...bug({ title: 'Pagar no responde', section: 'SPRINT_BOARD', sprintId: 's4' }), project: undefined }],
    );

    expect(await screen.findByText('Casos de devoluciones')).toBeInTheDocument();
    expect(screen.getByText('Pagar no responde')).toBeInTheDocument();
    expect(await screen.findByText(/Sprint 4 · 0 de 2 tickets del sprint · 1 bug abierto/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Avance de Checkout Web' })).toHaveAttribute('aria-valuenow', '0');

    const heading = screen.getByRole('heading', { level: 1 });
    expect(within(heading).getByText(/Ayinsson/)).toBeInTheDocument();
    expect(screen.queryByText('126')).not.toBeInTheDocument();
  });

  it('celebrates with one all-clear card when nothing is pending', async () => {
    await renderWith([{ id: 'p1', name: 'Checkout Web', logoUrl: null }]);
    expect(await screen.findByRole('heading', { name: 'Todo al día' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Asignado a ti' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tus proyectos' })).toBeInTheDocument();
  });
});
