import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

import type { PlanningView, PlanTicket, ProgressStats } from '../../../lib/planning';
import { ToastProvider } from '../../../ui';
import { PlanningPanel } from './PlanningPanel';
import { addsScopeToday, forecastLabel, formatPlanDate, matchesTicket, progressLabel } from './planningLogic';

vi.mock('../../../lib/planning', () => ({
  getPlanning: vi.fn(),
  createStage: vi.fn().mockResolvedValue(undefined),
  updateStage: vi.fn().mockResolvedValue(undefined),
  deleteStage: vi.fn().mockResolvedValue(undefined),
  createGroup: vi.fn().mockResolvedValue(undefined),
  updateGroup: vi.fn().mockResolvedValue(undefined),
  deleteGroup: vi.fn().mockResolvedValue(undefined),
  assignTicketToGroup: vi.fn().mockResolvedValue(undefined),
}));

function stats(overrides: Partial<ProgressStats> = {}): ProgressStats {
  return {
    total: 3,
    done: 1.5,
    committed: 2,
    added: 1,
    actualPct: 50,
    expectedPct: 87,
    status: 'AT_RISK',
    forecastEnd: '2026-12-07',
    slipDays: 11,
    ...overrides,
  };
}

function ticket(overrides: Partial<PlanTicket>): PlanTicket {
  return {
    type: 'TASK',
    id: 't1',
    itemKey: 'CAL-001',
    title: 'Hacer el kickoff',
    status: 'DONE',
    priority: 'MEDIUM',
    startDate: '2026-11-02T00:00:00.000Z',
    dueDate: '2026-11-02T00:00:00.000Z',
    assignedTo: null,
    assigneeName: 'Delia',
    stageGroupId: 'g1',
    parentType: null,
    parentId: null,
    isDone: true,
    subtasks: { done: 0, total: 0 },
    addedAfterStart: false,
    ...overrides,
  };
}

const PLAN: PlanningView = {
  today: '2026-11-18',
  project: { overallPct: 50, plannedEnd: '2026-12-18', forecastEnd: '2027-01-04', slipDays: 11 },
  stages: [
    {
      id: 's1',
      projectId: 'p1',
      position: 0,
      code: 'I1',
      name: 'Análisis y diseño',
      ownerName: 'Equipo completo',
      startDate: '2026-11-02',
      endDate: '2026-11-20',
      deliverables: '1. Documento de reglas',
      exitCriteria: 'Reglas firmadas',
      createdOn: '2026-10-30',
      stats: stats(),
      groups: [
        {
          id: 'g1',
          stageId: 's1',
          projectId: 'p1',
          position: 0,
          name: '1. Plan y dependencias',
          ownerName: null,
          startDate: '2026-11-02',
          endDate: '2026-11-13',
          stats: stats({ status: 'DELAYED', actualPct: 75 }),
          tickets: [
            ticket({}),
            ticket({ id: 't2', itemKey: 'CAL-002', title: 'Entregar la minuta', status: 'IN_PROGRESS', isDone: false, subtasks: { done: 1, total: 2 } }),
            ticket({ type: 'BUG', id: 'b1', itemKey: 'CAL-003', title: 'Falla la carga', status: 'OPEN', isDone: false, addedAfterStart: true }),
          ],
        },
      ],
    },
  ],
  unplannedTickets: [ticket({ id: 't9', itemKey: 'CAL-009', title: 'Revisar catálogo', status: 'TODO', isDone: false, stageGroupId: null })],
};

function renderPanel(plan: PlanningView = PLAN) {
  const onOpenTicket = vi.fn();
  return import('../../../lib/planning').then((api) => {
    vi.mocked(api.getPlanning).mockResolvedValue(plan);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <PlanningPanel accessToken="token" projectId="p1" onOpenTicket={onOpenTicket} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    return { api, onOpenTicket };
  });
}

describe('planning logic', () => {
  it('formats dates, progress and forecasts in plain words', () => {
    expect(formatPlanDate('2026-11-02', 2026)).toBe('2 nov');
    expect(formatPlanDate('2027-01-04T00:00:00.000Z', 2026)).toBe('4 ene 2027');
    expect(progressLabel({ done: 4.5, total: 10 })).toBe('4,5 de 10 tickets');
    expect(progressLabel({ done: 1, total: 1 })).toBe('1 de 1 ticket');
    expect(forecastLabel(stats(), 2026)).toBe('A este ritmo termina el 7 dic · 11 días hábiles tarde');
    expect(forecastLabel(stats({ forecastEnd: null, status: 'ON_TRACK', slipDays: 0 }), 2026)).toBe(
      'Aún sin tickets cerrados para proyectar',
    );
    expect(forecastLabel(stats({ status: 'COMPLETED' }), 2026)).toBeNull();
    expect(matchesTicket({ itemKey: 'CAL-009', title: 'Revisar catálogo' }, 'catalogo')).toBe(true);
  });

  it('warns about added scope only after the baseline cut', () => {
    const stage = { startDate: '2026-11-02', endDate: '2026-11-27', createdOn: '2026-10-28' };
    expect(addsScopeToday(stage, '2026-11-02')).toBe(false);
    expect(addsScopeToday(stage, '2026-11-10')).toBe(true);
    expect(addsScopeToday(stage, '2026-11-30')).toBe(false);
    // Plan armado hoy con la etapa ya en curso: lo de hoy cuenta como comprometido.
    expect(addsScopeToday({ ...stage, createdOn: '2026-11-18' }, '2026-11-18')).toBe(false);
  });
});

describe('PlanningPanel', () => {
  it('invites to create the first stage when the project has no planning', async () => {
    const { api } = await renderPanel({ ...PLAN, stages: [], project: { overallPct: null, plannedEnd: null, forecastEnd: null, slipDays: 0 } });

    expect(await screen.findByText('Este proyecto aún no tiene planning')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear primera etapa' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Análisis' } });
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-11-02' } });
    fireEvent.change(screen.getByLabelText('Fin comprometido'), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear etapa' }));
    expect(screen.getByText('La fecha de fin no puede ser anterior a la de inicio.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Fin comprometido'), { target: { value: '2026-11-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear etapa' }));
    await waitFor(() =>
      expect(api.createStage).toHaveBeenCalledWith('token', 'p1', expect.objectContaining({ name: 'Análisis', endDate: '2026-11-20', code: null })),
    );
  });

  it('shows each stage with real vs expected progress, risk, baseline and forecast', async () => {
    await renderPanel();

    const stage = await screen.findByRole('region', { name: 'Etapa I1 Análisis y diseño' });
    expect(within(stage).getAllByText('En riesgo')[0]).toBeInTheDocument();
    expect(within(stage).getByText('1,5 de 3 tickets')).toBeInTheDocument();
    expect(within(stage).getByText(/Agregado después \+1/)).toBeInTheDocument();
    expect(within(stage).getByText('A este ritmo termina el 7 dic · 11 días hábiles tarde')).toBeInTheDocument();
    expect(within(stage).getByRole('img', { name: 'Avance real 50%, esperado 87%' })).toBeInTheDocument();
    expect(screen.getByText(/Posible desfase de/)).toHaveTextContent('Posible desfase de 11 días hábiles por I1.');

    const group = within(stage).getByRole('group', { name: '1. Plan y dependencias' });
    expect(within(group).getByText('Atrasada')).toBeInTheDocument();
    expect(within(group).getByText('1/2')).toBeInTheDocument();
    expect(within(group).getByText('Agregado')).toBeInTheDocument();

    expect(screen.getByText('1 · 1 pendiente')).toBeInTheDocument();
  });

  it('opens a ticket and removes it from the planning', async () => {
    const { api, onOpenTicket } = await renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Falla la carga' }));
    expect(onOpenTicket).toHaveBeenCalledWith({ type: 'bug', id: 'b1' });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar CAL-002 del planning' }));
    await waitFor(() => expect(api.assignTicketToGroup).toHaveBeenCalledWith('token', expect.objectContaining({ id: 't2' }), null));
  });

  it('adds unplanned tickets to a macroactividad, warning that the stage is already running', async () => {
    const { api } = await renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar tickets' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar tickets a 1. Plan y dependencias' });
    expect(within(dialog).getByText(/ya está en curso/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar 1' }));
    await waitFor(() => expect(api.assignTicketToGroup).toHaveBeenCalledWith('token', expect.objectContaining({ id: 't9' }), 'g1'));
  });

  it('asks before deleting a stage and explains tickets are kept', async () => {
    const { api } = await renderPanel();

    const stage = await screen.findByRole('region', { name: 'Etapa I1 Análisis y diseño' });
    fireEvent.click(within(stage).getAllByRole('button', { name: 'Eliminar' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Eliminar etapa I1' });
    expect(within(dialog).getByText(/Los tickets no se borran/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(api.deleteStage).toHaveBeenCalledWith('token', 's1'));
  });
});
