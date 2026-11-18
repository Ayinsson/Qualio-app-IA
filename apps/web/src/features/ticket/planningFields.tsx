import { useState } from 'react';

import type { PlanningView } from '../../lib/planning';
import { describeImpact, previewStageImpact, stageOptions } from '../project/planning/planningImpact';
import { Button, Field, Input, ItemKey, Select } from '../../ui';

export type TicketRef = { type: 'task' | 'bug'; id: string; itemKey: string | null; title: string; status?: string };

const FINISHED = new Set(['DONE', 'RESOLVED', 'CLOSED']);

/** Selector "Etapa": macroactividades agrupadas por etapa, más "Sin planificar". */
export function StageSelect({
  id,
  plan,
  value,
  onChange,
}: {
  id: string;
  plan: PlanningView | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = stageOptions(plan);
  return (
    <Field id={id} label="Etapa" hint={options.length === 0 ? 'Este proyecto aún no tiene planning.' : undefined}>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={options.length === 0}>
        <option value="">Sin planificar</option>
        {options.map((option) => (
          <optgroup key={option.stageLabel} label={option.stageLabel}>
            {option.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  );
}

/**
 * Aviso (nunca bloquea) al sumar trabajo a una etapa: cómo cambia su avance y si
 * contará como alcance agregado. También avisa si el ticket queda sin planificar.
 */
export function PlanningNotice({
  plan,
  groupId,
  currentGroupId = null,
  isNew = false,
  isSubtask = false,
}: {
  plan: PlanningView | undefined;
  groupId: string;
  currentGroupId?: string | null;
  isNew?: boolean;
  isSubtask?: boolean;
}) {
  if (!plan || plan.stages.length === 0 || isSubtask) {
    return null;
  }
  if (!groupId) {
    return isNew ? (
      <p className="qt-notice" role="status">
        Quedará sin planificar y no contará para ninguna etapa.
      </p>
    ) : null;
  }
  const impact = previewStageImpact(plan, groupId, currentGroupId);
  if (!impact) {
    return null;
  }
  return (
    <p className={`qt-notice${impact.addsScope ? ' qt-notice--warn' : ''}`} role="status">
      {describeImpact(impact)}
      {impact.addsScope ? '. La etapa ya está en curso: se registrará como alcance agregado.' : '.'}
      {impact.addsScope && isNew ? ' Si es una dependencia de otro ticket, elige "Subtarea de" para no ampliar el alcance.' : null}
    </p>
  );
}

/** Subtareas del ticket: dependencias que deben cerrarse antes de cerrarlo. */
export function SubtasksSection({
  subtasks,
  onOpen,
  onAdd,
}: {
  subtasks: TicketRef[];
  onOpen?: (ticket: TicketRef) => void;
  /** Rechaza si falla; quien llama muestra el aviso. */
  onAdd?: (input: { type: 'task' | 'bug'; title: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'task' | 'bug'>('task');
  const [adding, setAdding] = useState(false);
  const open = subtasks.filter((ticket) => !FINISHED.has(ticket.status ?? '')).length;

  const add = async () => {
    if (!onAdd || title.trim().length < 3) {
      return;
    }
    setAdding(true);
    try {
      await onAdd({ type, title: title.trim() });
      setTitle('');
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="qt-block" aria-label="Subtareas">
      <h3 className="q-field__label">
        Subtareas
        {subtasks.length > 0 ? (
          <span className="qt-count" aria-hidden="true">
            {subtasks.length - open}/{subtasks.length}
          </span>
        ) : null}
      </h3>
      <p className="qt-muted">Son dependencias: no suman alcance a la etapa y el ticket no se puede cerrar mientras tenga subtareas abiertas.</p>
      {subtasks.length > 0 ? (
        <ul className="qt-subtasks">
          {subtasks.map((ticket) => (
            <li key={`${ticket.type}:${ticket.id}`} className={FINISHED.has(ticket.status ?? '') ? 'is-done' : undefined}>
              <ItemKey itemType={ticket.type} value={ticket.itemKey ?? '—'} />
              <button type="button" className="qt-link" onClick={() => onOpen?.(ticket)}>
                {ticket.title}
              </button>
              <span className="qt-muted">{FINISHED.has(ticket.status ?? '') ? 'Cerrada' : 'Abierta'}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {onAdd ? (
        <div className="qt-subtask-form">
          <label className="sr-only" htmlFor="subtask-title">
            Título de la subtarea
          </label>
          <Input
            id="subtask-title"
            value={title}
            maxLength={200}
            placeholder="Nueva subtarea"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void add();
              }
            }}
          />
          <label className="sr-only" htmlFor="subtask-type">
            Tipo de subtarea
          </label>
          <Select id="subtask-type" value={type} onChange={(event) => setType(event.target.value as 'task' | 'bug')}>
            <option value="task">Tarea</option>
            <option value="bug">Bug</option>
          </Select>
          <Button size="sm" onClick={() => void add()} loading={adding} disabled={title.trim().length < 3}>
            Agregar subtarea
          </Button>
        </div>
      ) : null}
    </section>
  );
}
