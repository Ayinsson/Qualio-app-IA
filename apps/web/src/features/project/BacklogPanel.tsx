import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import { normalizeSearch } from '../../layout/navigation';
import type { ProjectMember } from '../../lib/project-members';
import { Avatar, BugIcon, Button, Card, ChevronRightIcon, DotsIcon, EmptyState, Input, ItemKey, Priority, SearchIcon, TaskIcon } from '../../ui';
import { describeDue } from '../dashboard/dashboardLogic';
import type { BacklogSectionId, PlanItem } from './types';

type TypeFilter = 'all' | 'task' | 'bug';

export type BacklogDragApi = {
  draggedId: string | null;
  overSection: BacklogSectionId | null;
  overItemId: string | null;
  flashId: string | null;
  onDragStart: (itemId: string) => void;
  onDragEnd: () => void;
  onDragOverSection: (section: BacklogSectionId) => void;
  onDragOverItem: (section: BacklogSectionId, itemId: string) => void;
  onDragLeaveSection: (section: BacklogSectionId) => void;
  onDropSection: (section: BacklogSectionId) => void;
  onDropItem: (section: BacklogSectionId, itemId: string) => void;
};

type BacklogPanelProps = {
  items: PlanItem[];
  memberById: Map<string, ProjectMember>;
  drag: BacklogDragApi;
  onOpen: (item: PlanItem) => void;
  onMove: (item: PlanItem, section: BacklogSectionId) => void;
  /** Si el proyecto aún no tiene ningún ticket, se da la bienvenida en lugar de las secciones vacías. */
  emptyProject?: { onCreateTask: () => void; onCreateBug: () => void };
};

const SECTIONS: Array<{ id: BacklogSectionId; title: string; note?: string; empty: string }> = [
  {
    id: 'nextSprint',
    title: 'Próximo Sprint',
    note: 'Entra al tablero al iniciar el sprint',
    empty: 'Arrastra tickets aquí, o usa "Mover a Próximo Sprint", para planificar el siguiente sprint.',
  },
  {
    id: 'general',
    title: 'Backlog general',
    empty: 'Aquí llegan las tareas y bugs nuevos hasta que los planifiques.',
  },
];

function matches(item: PlanItem, query: string, assigneeName: string) {
  if (!query) {
    return true;
  }
  return [item.displayKey, item.title, assigneeName].some((value) => normalizeSearch(value).includes(query));
}

function RowMenu({ item, onOpen, onMove }: { item: PlanItem; onOpen: () => void; onMove: (section: BacklogSectionId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const target: BacklogSectionId = item.section === 'nextSprint' ? 'general' : 'nextSprint';

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="qx-menu" ref={ref} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="q-icon-btn"
        aria-label={`Acciones de ${item.displayKey}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <DotsIcon size={18} />
      </button>
      {open ? (
        <div className="qx-menu-list qx-menu-list--right" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onMove(target);
            }}
          >
            <ChevronRightIcon size={16} />
            {target === 'nextSprint' ? 'Mover a Próximo Sprint' : 'Mover a Backlog general'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            <SearchIcon size={16} />
            Abrir detalle
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BacklogPanel({ items, memberById, drag, onOpen, onMove, emptyProject }: BacklogPanelProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const needle = normalizeSearch(query);
  const filtering = Boolean(needle) || typeFilter !== 'all';

  const nameOf = (userId: string | null) => {
    if (!userId) {
      return '';
    }
    const member = memberById.get(userId);
    return member?.name?.trim() || member?.email || '';
  };

  const visible = items.filter(
    (item) => (typeFilter === 'all' || item.itemType === typeFilter) && matches(item, needle, nameOf(item.assigneeUserId)),
  );

  const allowDrop = (event: DragEvent) => event.preventDefault();

  if (emptyProject) {
    return (
      <Card className="qx-welcome">
        <EmptyState
          illustrated
          title="Empieza a planificar"
          description="Crea la primera tarea o reporta un bug. Todo entra al backlog, y desde ahí lo llevas al sprint."
          action={
            <>
              <Button icon={<BugIcon size={16} />} onClick={emptyProject.onCreateBug}>
                Reportar bug
              </Button>
              <Button variant="primary" icon={<TaskIcon size={16} />} onClick={emptyProject.onCreateTask}>
                Crear tarea
              </Button>
            </>
          }
        />
      </Card>
    );
  }

  return (
    <div className="qx-backlog">
      <div className="qx-toolbar">
        <label className="qx-search">
          <SearchIcon size={16} />
          <span className="sr-only">Buscar en el backlog</span>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por clave, título o responsable"
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

      {SECTIONS.map((section) => {
        const sectionItems = visible.filter((item) => item.section === section.id);
        const total = items.filter((item) => item.section === section.id).length;

        return (
          <section
            key={section.id}
            className={`qx-section${drag.overSection === section.id ? ' is-drop-target' : ''}`}
            aria-label={section.title}
            onDragOver={(event) => {
              allowDrop(event);
              drag.onDragOverSection(section.id);
            }}
            onDragLeave={() => drag.onDragLeaveSection(section.id)}
            onDrop={(event) => {
              allowDrop(event);
              drag.onDropSection(section.id);
            }}
          >
            <header className="qx-section-head">
              <h2>{section.title}</h2>
              <span className="qx-count">{filtering ? `${sectionItems.length} de ${total}` : total}</span>
              {section.note ? <span className="qx-section-note">{section.note}</span> : null}
            </header>

            {sectionItems.length > 0 ? (
              <ul className="qx-rows">
                {sectionItems.map((item) => {
                  const member = item.assigneeUserId ? memberById.get(item.assigneeUserId) ?? null : null;
                  const due = describeDue(item.dueDate);
                  return (
                    <li
                      key={item.id}
                      className={[
                        'qx-row',
                        drag.draggedId === item.id ? 'is-dragging' : '',
                        drag.overItemId === item.id ? 'is-drop-before' : '',
                        drag.flashId === item.id ? 'is-flash' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      draggable
                      onDragStart={() => drag.onDragStart(item.id)}
                      onDragEnd={drag.onDragEnd}
                      onDragOver={(event) => {
                        allowDrop(event);
                        drag.onDragOverItem(section.id, item.id);
                      }}
                      onDrop={(event) => {
                        allowDrop(event);
                        event.stopPropagation();
                        drag.onDropItem(section.id, item.id);
                      }}
                      onClick={() => onOpen(item)}
                    >
                      <span className="qx-grip" aria-hidden="true">
                        ⠿
                      </span>
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
                      <Priority value={item.priority} />
                      <span className="qx-assignee">
                        {member ? (
                          <Avatar name={member.name?.trim() || member.email} src={member.avatarUrl} size={24} />
                        ) : (
                          <span className="qx-unassigned" title="Sin asignar" aria-label="Sin asignar" />
                        )}
                      </span>
                      <span className={`qx-due${due ? ` is-${due.tone}` : ''}`}>{due?.label ?? ''}</span>
                      <RowMenu item={item} onOpen={() => onOpen(item)} onMove={(target) => onMove(item, target)} />
                    </li>
                  );
                })}
              </ul>
            ) : filtering && total > 0 ? (
              <p className="qx-empty-note">Ningún ticket de esta sección coincide con el filtro.</p>
            ) : (
              <p className="qx-dropzone">{section.empty}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
