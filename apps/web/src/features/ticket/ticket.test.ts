import { buildActivity, describeChange, formatEventTime } from './historyLogic';
import type { HistoryEntry } from './historyLogic';

const context = {
  itemType: 'task' as const,
  memberName: (id: string) => (id === 'u-ana' ? 'Ana Pérez' : null),
};

function entry(overrides: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: Math.random().toString(),
    changedBy: 'u-me',
    changedByName: 'Ayinsson Solano',
    changedByEmail: 'a@b.com',
    fieldName: 'status',
    oldValue: 'TODO',
    newValue: 'IN_PROGRESS',
    changeNote: null,
    createdAt: '2026-11-17T10:42:00.120Z',
    ...overrides,
  };
}

const text = (parts: ReturnType<typeof describeChange>) => parts?.map((part) => part.text).join('') ?? null;

describe('describeChange', () => {
  it('translates codes into words people use', () => {
    expect(text(describeChange(entry({}), context))).toBe('cambió el estado de Pendiente a En progreso');
    expect(
      text(describeChange(entry({ fieldName: 'status', oldValue: 'OPEN', newValue: 'RESOLVED' }), { ...context, itemType: 'bug' })),
    ).toBe('cambió el estado de Bug abierto a Resuelto');
    expect(text(describeChange(entry({ fieldName: 'section', oldValue: 'NEXT_SPRINT', newValue: 'SPRINT_BOARD' }), context))).toBe(
      'lo pasó de Próximo Sprint a tablero del sprint',
    );
    expect(text(describeChange(entry({ fieldName: 'priority', oldValue: 'MEDIUM', newValue: 'HIGH' }), context))).toBe(
      'cambió la prioridad de Media a Alta',
    );
  });

  it('shows people and dates instead of ids and ISO strings', () => {
    expect(text(describeChange(entry({ fieldName: 'assigned_to', oldValue: null, newValue: 'u-ana' }), context))).toBe(
      'lo asignó a Ana Pérez',
    );
    expect(text(describeChange(entry({ fieldName: 'assigned_to', oldValue: 'u-ana', newValue: null }), context))).toBe(
      'quitó la asignación',
    );
    expect(
      text(describeChange(entry({ fieldName: 'due_date', oldValue: null, newValue: '2026-11-18T00:00:00.000Z' }), context)),
    ).toBe('cambió la fecha objetivo al 18 nov');
  });

  it('hides internal sprint bookkeeping', () => {
    expect(describeChange(entry({ fieldName: 'completed_in_sprint_id', newValue: 'uuid' }), context)).toBeNull();
    expect(describeChange(entry({ fieldName: 'sprint_id', newValue: 'uuid' }), context)).toBeNull();
  });
});

describe('buildActivity', () => {
  it('groups changes saved together, newest first, with the note', () => {
    const events = buildActivity(
      [
        entry({ fieldName: 'status', createdAt: '2026-11-16T23:32:10.000Z' }),
        entry({ fieldName: 'status', oldValue: 'IN_PROGRESS', newValue: 'DONE', createdAt: '2026-11-17T10:42:00.100Z', changeNote: 'Listo' }),
        entry({ fieldName: 'completed_in_sprint_id', oldValue: null, newValue: 's1', createdAt: '2026-11-17T10:42:00.300Z' }),
        entry({ fieldName: 'sprint_id', createdAt: '2026-11-15T08:00:00.000Z' }),
      ],
      context,
    );

    expect(events).toHaveLength(2);
    expect(events[0].lines).toHaveLength(1);
    expect(events[0].note).toBe('Listo');
    expect(events[0].actorName).toBe('Ayinsson Solano');
    expect(new Date(events[1].at).getUTCDate()).toBe(16);
  });
});

describe('formatEventTime', () => {
  it('uses today and yesterday', () => {
    const now = new Date(2026, 10, 17, 12, 0);
    expect(formatEventTime(new Date(2026, 10, 17, 10, 42).toISOString(), now)).toMatch(/^hoy, 10:42$/);
    expect(formatEventTime(new Date(2026, 10, 16, 23, 32).toISOString(), now)).toMatch(/^ayer, 23:32$/);
    expect(formatEventTime(new Date(2026, 10, 2, 9, 5).toISOString(), now)).toMatch(/^2 nov, 09:05$/);
  });
});
