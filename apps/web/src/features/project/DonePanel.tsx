import { useState } from 'react';

import { normalizeSearch } from '../../layout/navigation';
import { Button, Card, EmptyState, Input, ItemKey, Modal, Priority, SearchIcon, TaskIcon } from '../../ui';
import type { DoneItem, ReopenDestination } from './types';

type TypeFilter = 'all' | 'task' | 'bug';

type DonePanelProps = {
  items: DoneItem[];
  activeSprint: { id: string; name: string } | null;
  reopening: boolean;
  onReopen: (item: DoneItem, destination: ReopenDestination) => void;
  onOpen: (item: DoneItem) => void;
};

type SprintGroup = { id: string; name: string; sequence: number; items: DoneItem[] };

function groupBySprint(items: DoneItem[]): SprintGroup[] {
  const groups = new Map<string, SprintGroup>();
  items.forEach((item) => {
    const group = groups.get(item.sprintId) ?? {
      id: item.sprintId,
      name: item.sprintName,
      sequence: item.sprintSequence,
      items: [],
    };
    group.items.push(item);
    groups.set(item.sprintId, group);
  });

  return [...groups.values()]
    .sort((a, b) => b.sequence - a.sequence)
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()),
    }));
}

function countLabel(items: DoneItem[]): string {
  const tasks = items.filter((item) => item.itemType === 'task').length;
  const bugs = items.length - tasks;
  return [tasks ? `${tasks} ${tasks === 1 ? 'tarea' : 'tareas'}` : '', bugs ? `${bugs} ${bugs === 1 ? 'bug' : 'bugs'}` : '']
    .filter(Boolean)
    .join(' · ');
}

const formatDay = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(value));

export function DonePanel({ items, activeSprint, reopening, onReopen, onOpen }: DonePanelProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [toReopen, setToReopen] = useState<DoneItem | null>(null);
  const [destination, setDestination] = useState<ReopenDestination>('backlog');

  if (items.length === 0) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={<TaskIcon size={22} />}
          title="Aún no hay tickets terminados"
          description="Cuando marques un ticket como hecho en el tablero, quedará aquí agrupado por sprint."
        />
      </Card>
    );
  }

  const needle = normalizeSearch(query);
  const visible = items.filter(
    (item) =>
      (typeFilter === 'all' || item.itemType === typeFilter) &&
      (!needle || [item.displayKey, item.title].some((value) => normalizeSearch(value).includes(needle))),
  );
  const groups = groupBySprint(visible);

  const startReopen = (item: DoneItem) => {
    setDestination('backlog');
    setToReopen(item);
  };

  return (
    <div className="qx-backlog">
      <div className="qx-toolbar">
        <label className="qx-search">
          <SearchIcon size={16} />
          <span className="sr-only">Buscar en completados</span>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por clave o título"
          />
        </label>
        <div className="qx-segmented" role="group" aria-label="Filtrar por tipo">
          {(
            [
              ['all', 'Todo'],
              ['task', 'Tareas'],
              ['bug', 'Bugs'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={typeFilter === id} onClick={() => setTypeFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? <p className="qx-empty-note">Ningún ticket terminado coincide con el filtro.</p> : null}

      {groups.map((group) => {
        const isCurrent = group.id === activeSprint?.id;
        return (
          <section key={group.id} className="qx-section" aria-label={group.name}>
            <header className="qx-section-head">
              <h2>{group.name}</h2>
              <span className={`qd-chip ${isCurrent ? 'is-current' : 'is-closed'}`}>{isCurrent ? 'En curso' : 'Cerrado'}</span>
              <span className="qx-count">{countLabel(group.items)}</span>
            </header>
            <ul className="qx-rows">
              {group.items.map((item) => (
                <li key={item.id} className="qx-row qc-row" onClick={() => onOpen(item)}>
                  <ItemKey itemType={item.itemType} value={item.displayKey} />
                  <button
                    type="button"
                    className="qx-row-title"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(item);
                    }}
                  >
                    {item.title}
                  </button>
                  <Priority value={item.priority} showLabel={false} />
                  <span className="qc-date">Terminado el {formatDay(item.completedAt)}</span>
                  <Button
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      startReopen(item);
                    }}
                  >
                    Reabrir
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Modal
        open={Boolean(toReopen)}
        title={toReopen ? `Reabrir ${toReopen.displayKey}` : ''}
        onClose={() => setToReopen(null)}
        footer={
          <>
            <Button onClick={() => setToReopen(null)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={reopening}
              onClick={() => {
                if (toReopen) {
                  onReopen(toReopen, destination);
                }
                setToReopen(null);
              }}
            >
              Reabrir ticket
            </Button>
          </>
        }
      >
        <fieldset className="qc-options">
          <legend className="qc-legend">¿A dónde debe volver?</legend>
          <label className={`qc-option${destination === 'backlog' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="reopen-destination"
              checked={destination === 'backlog'}
              onChange={() => setDestination('backlog')}
            />
            <span>
              <strong>Al backlog general</strong>
              <small>Para volver a planificarlo más adelante.</small>
            </span>
          </label>
          {activeSprint ? (
            <label className={`qc-option${destination === 'sprint' ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="reopen-destination"
                checked={destination === 'sprint'}
                onChange={() => setDestination('sprint')}
              />
              <span>
                <strong>Al tablero de {activeSprint.name}</strong>
                <small>Vuelve a "Por hacer" en el sprint en curso.</small>
              </span>
            </label>
          ) : null}
        </fieldset>
      </Modal>
    </div>
  );
}
