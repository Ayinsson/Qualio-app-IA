import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ToastProvider } from '../../ui';
import { computeProgress, progressLabel } from './progress';
import { filterProjects, validateNewProject } from './projectsLogic';
import { ProjectsView } from './ProjectsView';

vi.mock('../../lib/projects', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  archiveProject: vi.fn(),
  updateProject: vi.fn(),
}));
vi.mock('../../lib/sprints', () => ({ getActiveSprint: vi.fn() }));
vi.mock('../../lib/bugs', () => ({ listBugs: vi.fn() }));
vi.mock('../../lib/tasks', () => ({ listTasks: vi.fn() }));

const base = {
  logoUrl: null,
  description: null,
  projectType: 'App web',
  status: 'ACTIVE',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
};
const mine = { ...base, id: 'p1', name: 'Checkout Web', ownerId: 'me' };
const shared = { ...base, id: 'p2', name: 'Operación móvil', ownerId: 'other', projectType: 'App movil' };
const archived = { ...base, id: 'p3', name: 'Landing Black Friday', ownerId: 'me', status: 'ARCHIVED' };

describe('projects logic', () => {
  it('filters by name ignoring accents', () => {
    expect(filterProjects([mine, shared] as never, 'operacion').map((p) => p.id)).toEqual(['p2']);
    expect(filterProjects([mine, shared] as never, '  ')).toHaveLength(2);
  });

  it('measures sprint progress from real tasks and bugs', () => {
    const sprint = { id: 's1' } as never;
    const progress = computeProgress(
      [
        { section: 'SPRINT_BOARD', sprintId: 's1', status: 'DONE' },
        { section: 'SPRINT_BOARD', sprintId: 's1', status: 'IN_PROGRESS' },
        { section: 'NEXT_SPRINT', sprintId: null, status: 'TODO' },
      ] as never,
      [
        { section: 'SPRINT_BOARD', sprintId: 's1', status: 'RESOLVED', priority: 'LOW' },
        { section: 'GENERAL_BACKLOG', sprintId: null, status: 'OPEN', priority: 'HIGH' },
      ] as never,
      sprint,
    );
    expect(progress).toEqual({ sprintTotal: 3, sprintDone: 2, percent: 67, backlogCount: 2, openBugs: 1, highOpenBugs: 1 });
    expect(progressLabel(progress!, true)).toBe('2 de 3 tickets del sprint');
    expect(progressLabel(progress!, false)).toBe('2 tickets en backlog');
    expect(computeProgress(undefined, [], null)).toBeNull();
  });

  it('explains every invalid field', () => {
    expect(validateNewProject({ name: 'ab', projectType: '', logoUrl: 'logo.png', description: '' })).toEqual({
      name: 'El nombre necesita al menos 3 caracteres.',
      projectType: 'Elige qué tipo de producto vas a probar.',
      logoUrl: 'Pega una dirección que empiece por https://',
    });
    expect(validateNewProject({ name: 'Checkout', projectType: 'App web', logoUrl: '', description: '' })).toEqual({});
  });
});

describe('ProjectsView', () => {
  async function setup(path: string) {
    const projects = await import('../../lib/projects');
    const sprints = await import('../../lib/sprints');
    const bugs = await import('../../lib/bugs');
    const tasks = await import('../../lib/tasks');
    vi.mocked(projects.listProjects).mockImplementation(async (_token, status) =>
      (status === 'ARCHIVED' ? [archived] : [mine, shared]) as never,
    );
    vi.mocked(sprints.getActiveSprint).mockResolvedValue({ id: 's1', name: 'Sprint 1' } as never);
    vi.mocked(tasks.listTasks).mockResolvedValue([
      { section: 'SPRINT_BOARD', sprintId: 's1', status: 'DONE' },
      { section: 'SPRINT_BOARD', sprintId: 's1', status: 'TODO' },
      { section: 'SPRINT_BOARD', sprintId: 's1', status: 'TODO' },
    ] as never);
    vi.mocked(bugs.listBugs).mockResolvedValue([
      { section: 'SPRINT_BOARD', sprintId: 's1', status: 'OPEN', priority: 'HIGH' },
      { section: 'GENERAL_BACKLOG', sprintId: null, status: 'OPEN', priority: 'LOW' },
    ] as never);
    localStorage.setItem('qualio_access_token', 'token');

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/app/proyectos/activos" element={<ProjectsView tab="active" currentUserId="me" />} />
              <Route path="/app/proyectos/nuevo" element={<ProjectsView tab="active" createOpen currentUserId="me" />} />
              <Route path="/app/proyectos/archivados" element={<ProjectsView tab="archived" currentUserId="me" />} />
              <Route path="/app/proyectos/:projectId" element={<p>Detalle del proyecto</p>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
    return projects;
  }

  it('lists projects with progress, bugs and ownership, and only offers archiving on my projects', async () => {
    await setup('/app/proyectos/activos');

    expect(await screen.findByText('Checkout Web')).toBeInTheDocument();
    expect(screen.getByText('App web · Tuyo')).toBeInTheDocument();
    expect(screen.getByText('App móvil · Compartido contigo')).toBeInTheDocument();
    expect((await screen.findAllByText('1 de 4 tickets del sprint')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sprint 1').length).toBeGreaterThan(0);
    expect((await screen.findAllByText('2 · 1 alto')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Acciones de Checkout Web' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acciones de Operación móvil' })).not.toBeInTheDocument();
  });

  it('asks for confirmation before archiving', async () => {
    const projects = await setup('/app/proyectos/activos');
    vi.mocked(projects.archiveProject).mockResolvedValue(mine as never);

    fireEvent.click(await screen.findByRole('button', { name: 'Acciones de Checkout Web' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archivar' }));
    expect(projects.archiveProject).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: '¿Archivar Checkout Web?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archivar proyecto' }));
    await waitFor(() => expect(projects.archiveProject).toHaveBeenCalledWith('token', 'p1'));
    expect(await screen.findByText(/se archivó/)).toBeInTheDocument();
  });

  it('restores an archived project', async () => {
    const projects = await setup('/app/proyectos/archivados');
    vi.mocked(projects.updateProject).mockResolvedValue({ ...archived, status: 'ACTIVE' } as never);

    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(projects.updateProject).toHaveBeenCalledWith('token', 'p3', { status: 'ACTIVE' }));
  });

  it('validates the form, creates the project and opens it', async () => {
    const projects = await setup('/app/proyectos/nuevo');
    vi.mocked(projects.createProject).mockResolvedValue({ ...mine, id: 'new-1', name: 'Portal' } as never);

    const dialog = await screen.findByRole('dialog', { name: 'Nuevo proyecto' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear y abrir' }));
    expect(await within(dialog).findByText('El nombre necesita al menos 3 caracteres.')).toBeInTheDocument();
    expect(projects.createProject).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Portal' } });
    fireEvent.click(within(dialog).getByLabelText('App web'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear y abrir' }));

    await waitFor(() =>
      expect(projects.createProject).toHaveBeenCalledWith('token', {
        name: 'Portal',
        projectType: 'App web',
        logoUrl: undefined,
        description: undefined,
      }),
    );
    expect(await screen.findByText('Detalle del proyecto')).toBeInTheDocument();
    expect(screen.getByText('Proyecto "Portal" creado.')).toBeInTheDocument();
  });
});
