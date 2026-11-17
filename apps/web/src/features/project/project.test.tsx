import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { BacklogPanel } from './BacklogPanel';
import { BoardPanel } from './BoardPanel';
import { DonePanel } from './DonePanel';
import type { BacklogDragApi } from './BacklogPanel';
import { SprintBar } from './SprintBar';
import type { BoardCard, DoneItem, PlanItem } from './types';

const drag: BacklogDragApi = {
  draggedId: null,
  overSection: null,
  overItemId: null,
  flashId: null,
  onDragStart: vi.fn(),
  onDragEnd: vi.fn(),
  onDragOverSection: vi.fn(),
  onDragOverItem: vi.fn(),
  onDragLeaveSection: vi.fn(),
  onDropSection: vi.fn(),
  onDropItem: vi.fn(),
};

function item(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'task-1',
    displayKey: 'ProyectTest-001',
    entityId: '1',
    title: 'Tarea',
    itemType: 'task',
    priority: 'Medio',
    assigneeUserId: null,
    dueDate: null,
    section: 'general',
    position: 0,
    ...overrides,
  };
}

const items = [
  item({ id: 'task-1', displayKey: 'ProyectTest-011', title: 'Pruebas de carga del checkout', section: 'nextSprint' }),
  item({ id: 'bug-2', itemType: 'bug', displayKey: 'ProyectTest-009', title: 'Stock desactualizado tras sincronizar' }),
  item({ id: 'task-3', displayKey: 'ProyectTest-006', title: 'Documentar el flujo de devoluciones', priority: 'Bajo' }),
];

describe('BacklogPanel', () => {
  it('groups tickets by section and filters by type and accent-insensitive search', () => {
    render(<BacklogPanel items={items} memberById={new Map()} drag={drag} onOpen={vi.fn()} onMove={vi.fn()} />);

    const next = screen.getByRole('region', { name: 'Próximo Sprint' });
    expect(within(next).getByText('Pruebas de carga del checkout')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bugs' }));
    expect(screen.queryByText('Documentar el flujo de devoluciones')).not.toBeInTheDocument();
    expect(screen.getByText('Stock desactualizado tras sincronizar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar por clave, título o responsable'), {
      target: { value: 'devolucion' },
    });
    expect(screen.getByText('Documentar el flujo de devoluciones')).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
  });

  it('moves a ticket between sections without dragging', () => {
    const onMove = vi.fn();
    render(<BacklogPanel items={items} memberById={new Map()} drag={drag} onOpen={vi.fn()} onMove={onMove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de ProyectTest-006' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover a Próximo Sprint' }));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-3' }), 'nextSprint');
  });

  it('invites to plan when Próximo Sprint is empty', () => {
    render(
      <BacklogPanel items={items.slice(1)} memberById={new Map()} drag={drag} onOpen={vi.fn()} onMove={vi.fn()} />,
    );
    expect(screen.getByText(/Arrastra tickets aquí/)).toBeInTheDocument();
  });
});

describe('BacklogPanel in a brand-new project', () => {
  it('welcomes with the first actions instead of empty sections', () => {
    const onCreateTask = vi.fn();
    const onCreateBug = vi.fn();
    render(
      <BacklogPanel
        items={[]}
        memberById={new Map()}
        drag={drag}
        onOpen={vi.fn()}
        onMove={vi.fn()}
        emptyProject={{ onCreateTask, onCreateBug }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Empieza a planificar' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Próximo Sprint' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Crear tarea' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reportar bug' }));
    expect(onCreateTask).toHaveBeenCalled();
    expect(onCreateBug).toHaveBeenCalled();
  });
});

describe('SprintBar', () => {
  const sprint = { id: 's1', name: 'Sprint 1', sequence: 1, startedAt: '2026-11-16T10:00:00.000Z' } as never;
  const progress = { sprintTotal: 6, sprintDone: 1, percent: 17, backlogCount: 6, openBugs: 5, highOpenBugs: 2 };

  it('explains what closing the sprint does before acting', () => {
    const onStart = vi.fn();
    render(
      <SprintBar sprint={sprint} progress={progress} nextSprintCount={2} unfinishedCount={5} isOwner starting={false} onStart={onStart} />,
    );

    expect(screen.getByText('1 de 6 tickets terminados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Sprint 1 e iniciar Sprint 2' }));
    expect(onStart).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: '¿Cerrar Sprint 1 e iniciar Sprint 2?' });
    expect(within(dialog).getByText('5 tickets sin terminar')).toBeInTheDocument();
    expect(within(dialog).getByText('2 tickets')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar Sprint 2' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('tells the owner how to unlock the next sprint, and hides the action from others', () => {
    const { rerender } = render(
      <SprintBar sprint={null} progress={progress} nextSprintCount={0} unfinishedCount={0} isOwner starting={false} onStart={vi.fn()} />,
    );
    expect(screen.getByText('Mueve tickets a Próximo Sprint para iniciar Sprint 1.')).toBeInTheDocument();

    rerender(
      <SprintBar sprint={sprint} progress={progress} nextSprintCount={2} unfinishedCount={5} isOwner={false} starting={false} onStart={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /iniciar Sprint 2/ })).not.toBeInTheDocument();
  });
});

function card(overrides: Partial<BoardCard>): BoardCard {
  return {
    id: 'task-1',
    entityId: '1',
    itemType: 'task',
    displayKey: 'ProyectTest-001',
    title: 'Casos del checkout',
    priority: 'HIGH',
    column: 'todo',
    assigneeUserId: null,
    dueDate: null,
    environment: null,
    rolloverFrom: null,
    ...overrides,
  };
}

describe('BoardPanel', () => {
  const cards = [
    card({ id: 'task-1', displayKey: 'ProyectTest-002', title: 'Regresión del carrito', assigneeUserId: 'me' }),
    card({ id: 'bug-7', itemType: 'bug', displayKey: 'ProyectTest-007', title: 'Pagar no responde', column: 'progress', environment: 'Staging', rolloverFrom: 'Sprint 1' }),
    card({ id: 'task-4', displayKey: 'ProyectTest-004', title: 'Matriz de navegadores', column: 'done' }),
  ];
  const renderBoard = (props: Partial<Parameters<typeof BoardPanel>[0]> = {}) =>
    render(
      <BoardPanel
        hasSprint
        cards={cards}
        memberById={new Map()}
        currentUserId="me"
        onMove={vi.fn()}
        onOpen={vi.fn()}
        onGoToBacklog={vi.fn()}
        {...props}
      />,
    );

  it('shows three columns with bug environment and rollover origin', () => {
    renderBoard();
    expect(within(screen.getByRole('region', { name: 'Por hacer' })).getByText('Regresión del carrito')).toBeInTheDocument();
    const progress = screen.getByRole('region', { name: 'En progreso' });
    expect(within(progress).getByText('Staging')).toBeInTheDocument();
    expect(within(progress).getByText('Viene de Sprint 1')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Hecho' })).getByText('Matriz de navegadores')).toBeInTheDocument();
  });

  it('filters to my tickets', () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Solo lo mío' }));
    expect(screen.getByText('Regresión del carrito')).toBeInTheDocument();
    expect(screen.queryByText('Pagar no responde')).not.toBeInTheDocument();
  });

  it('moves a card from the menu and keeps finished cards fixed', () => {
    const onMove = vi.fn();
    renderBoard({ onMove });
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de ProyectTest-002' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Marcar como hecho' }));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }), 'done');

    expect(screen.queryByRole('button', { name: 'Acciones de ProyectTest-004' })).not.toBeInTheDocument();
    const doneCard = screen.getByText('Matriz de navegadores').closest('li');
    expect(doneCard).toHaveAttribute('draggable', 'false');
  });

  it('explains how to start a sprint when there is none', () => {
    const onGoToBacklog = vi.fn();
    renderBoard({ hasSprint: false, onGoToBacklog });
    expect(screen.getByRole('heading', { name: 'No hay un sprint activo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir al backlog' }));
    expect(onGoToBacklog).toHaveBeenCalled();
  });
});

function done(overrides: Partial<DoneItem>): DoneItem {
  return {
    id: 'task-4',
    entityId: '4',
    itemType: 'task',
    displayKey: 'ProyectTest-004',
    title: 'Matriz de navegadores',
    priority: 'LOW',
    sprintId: 's1',
    sprintName: 'Sprint 1',
    sprintSequence: 1,
    completedAt: '2026-11-16T15:00:00.000Z',
    ...overrides,
  };
}

describe('DonePanel', () => {
  const items = [
    done({}),
    done({ id: 'bug-3', itemType: 'bug', displayKey: 'ProyectTest-020', title: 'Bug viejo', sprintId: 's0', sprintName: 'Sprint 0', sprintSequence: 0 }),
  ];

  it('groups by sprint, newest first, marking the current one', () => {
    render(<DonePanel items={items} activeSprint={{ id: 's1', name: 'Sprint 1' }} reopening={false} onReopen={vi.fn()} onOpen={vi.fn()} />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Sprint 1', 'Sprint 0']);
    expect(within(screen.getByRole('region', { name: 'Sprint 1' })).getByText('En curso')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Sprint 0' })).getByText('Cerrado')).toBeInTheDocument();
    expect(screen.getByText('1 tarea')).toBeInTheDocument();
  });

  it('asks where a reopened ticket goes, defaulting to the backlog', () => {
    const onReopen = vi.fn();
    render(<DonePanel items={items} activeSprint={{ id: 's1', name: 'Sprint 1' }} reopening={false} onReopen={onReopen} onOpen={vi.fn()} />);

    fireEvent.click(within(screen.getByRole('region', { name: 'Sprint 1' })).getByRole('button', { name: 'Reabrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Reabrir ProyectTest-004' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reabrir ticket' }));
    expect(onReopen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'task-4' }), 'backlog');

    fireEvent.click(within(screen.getByRole('region', { name: 'Sprint 1' })).getByRole('button', { name: 'Reabrir' }));
    const again = screen.getByRole('dialog', { name: 'Reabrir ProyectTest-004' });
    fireEvent.click(within(again).getByLabelText(/Al tablero de Sprint 1/));
    fireEvent.click(within(again).getByRole('button', { name: 'Reabrir ticket' }));
    expect(onReopen).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'task-4' }), 'sprint');
  });

  it('only offers the backlog when there is no active sprint, and explains an empty tab', () => {
    const { rerender } = render(<DonePanel items={items} activeSprint={null} reopening={false} onReopen={vi.fn()} onOpen={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Reabrir' })[0]);
    expect(screen.queryByLabelText(/Al tablero de/)).not.toBeInTheDocument();

    rerender(<DonePanel items={[]} activeSprint={null} reopening={false} onReopen={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Aún no hay tickets terminados' })).toBeInTheDocument();
  });
});
