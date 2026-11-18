import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import type { ProjectMember } from '../../lib/project-members';
import { Avatar, Button, DotsIcon, EmptyState, ItemKey, Priority, UserIcon } from '../../ui';
import { describeDue } from '../dashboard/dashboardLogic';
import type { BoardCard, BoardColumnId } from './types';

const COLUMNS: Array<{ id: BoardColumnId; title: string; tone: string }> = [
  { id: 'todo', title: 'Por hacer', tone: 'neutral' },
  { id: 'progress', title: 'En progreso', tone: 'running' },
  { id: 'done', title: 'Hecho', tone: 'success' },
];

const MOVE_LABEL: Record<BoardColumnId, string> = {
  todo: 'Mover a Por hacer',
  progress: 'Mover a En progreso',
  done: 'Marcar como hecho',
};

type TypeFilter = 'all' | 'task' | 'bug';

type BoardPanelProps = {
  hasSprint: boolean;
  cards: BoardCard[];
  memberById: Map<string, ProjectMember>;
  currentUserId: string | null;
  onMove: (card: BoardCard, column: BoardColumnId) => void;
  onOpen: (card: BoardCard) => void;
  onGoToBacklog: () => void;
};

function CardMenu({ card, onMove, onOpen }: { card: BoardCard; onMove: (column: BoardColumnId) => void; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const targets = COLUMNS.map((column) => column.id).filter((id) => id !== card.column);

  return (
    <div className="qx-menu qb-card-menu" ref={ref} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="q-icon-btn"
        aria-label={`Acciones de ${card.displayKey}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <DotsIcon size={16} />
      </button>
      {open ? (
        <div className="qx-menu-list" role="menu">
          {targets.map((target) => (
            <button
              key={target}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMove(target);
              }}
            >
              {MOVE_LABEL[target]}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            Abrir detalle
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function BoardPanel({ hasSprint, cards, memberById, currentUserId, onMove, onOpen, onGoToBacklog }: BoardPanelProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<BoardColumnId | null>(null);

  if (!hasSprint) {
    return (
      <div className="q-card">
        <EmptyState
          illustrated
          title="No hay un sprint activo"
          description="Planifica tickets en Próximo Sprint e inicia el sprint desde la barra de arriba. Entonces aparecerán aquí."
          action={<Button onClick={onGoToBacklog}>Ir al backlog</Button>}
        />
      </div>
    );
  }

  const visible = cards.filter(
    (card) =>
      (typeFilter === 'all' || card.itemType === typeFilter) &&
      (!onlyMine || (currentUserId !== null && card.assigneeUserId === currentUserId)),
  );
  const dragged = cards.find((card) => card.id === draggedId) ?? null;

  const allowDrop = (event: DragEvent) => event.preventDefault();
  const finishDrag = () => {
    setDraggedId(null);
    setOverColumn(null);
  };

  return (
    <div className="qb">
      <div className="qx-toolbar">
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
        <button type="button" className="qb-toggle" aria-pressed={onlyMine} onClick={() => setOnlyMine((value) => !value)}>
          <UserIcon size={16} />
          Solo lo mío
        </button>
      </div>

      <div className="qb-columns">
        {COLUMNS.map((column) => {
          const columnCards = visible.filter((card) => card.column === column.id);
          const acceptsDrop = Boolean(dragged) && dragged?.column !== column.id;

          return (
            <section
              key={column.id}
              className={[
                'qb-column',
                `qb-column--${column.tone}`,
                overColumn === column.id && acceptsDrop ? 'is-drop-target' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={column.title}
              onDragOver={(event) => {
                if (!acceptsDrop) {
                  return;
                }
                allowDrop(event);
                setOverColumn(column.id);
              }}
              onDragLeave={() => setOverColumn((current) => (current === column.id ? null : current))}
              onDrop={(event) => {
                allowDrop(event);
                if (dragged && acceptsDrop) {
                  onMove(dragged, column.id);
                }
                finishDrag();
              }}
            >
              <header className="qb-column-head">
                <span className="qb-dot" aria-hidden="true" />
                <h2>{column.title}</h2>
                <span className="qx-count">{columnCards.length}</span>
              </header>

              <ul className="qb-cards">
                {columnCards.map((card) => {
                  const member = card.assigneeUserId ? memberById.get(card.assigneeUserId) ?? null : null;
                  const due = column.id === 'done' ? null : describeDue(card.dueDate);
                  const isDone = card.column === 'done';

                  return (
                    <li
                      key={card.id}
                      className={['qb-card', isDone ? 'is-done' : '', draggedId === card.id ? 'is-dragging' : '']
                        .filter(Boolean)
                        .join(' ')}
                      draggable={!isDone}
                      onDragStart={() => setDraggedId(card.id)}
                      onDragEnd={finishDrag}
                      onClick={() => onOpen(card)}
                    >
                      <div className="qb-card-top">
                        <ItemKey itemType={card.itemType} value={card.displayKey} />
                        {!isDone ? <CardMenu card={card} onMove={(target) => onMove(card, target)} onOpen={() => onOpen(card)} /> : null}
                      </div>
                      <button
                        type="button"
                        className="qb-card-title"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(card);
                        }}
                      >
                        {card.parentKey ? <span className="qx-parent">↳ {card.parentKey}</span> : null}
                        {card.title}
                      </button>
                      <div className="qb-card-foot">
                        <Priority value={card.priority} showLabel={false} />
                        {card.itemType === 'bug' && card.environment ? (
                          <span className="qb-env">{card.environment}</span>
                        ) : null}
                        {due ? <span className={`qx-due is-${due.tone}`}>{due.label}</span> : null}
                        {member ? (
                          <span className="qb-assignee">
                            <Avatar name={member.name?.trim() || member.email} src={member.avatarUrl} size={22} />
                          </span>
                        ) : null}
                      </div>
                      {card.rolloverFrom && !isDone ? <span className="qb-rollover">Viene de {card.rolloverFrom}</span> : null}
                    </li>
                  );
                })}
              </ul>

              {columnCards.length === 0 ? (
                <p className="qb-empty">
                  {column.id === 'done' ? 'Arrastra aquí lo que termines.' : 'Sin tickets en esta columna.'}
                </p>
              ) : null}
              {column.id === 'done' && columnCards.length > 0 ? (
                <p className="qb-note">Para reabrir un ticket, ábrelo: volverá al backlog general.</p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
