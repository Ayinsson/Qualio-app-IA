import { useState } from 'react';
import type { FormEvent } from 'react';

import type { GroupPayload, PlanGroup, PlanStage, PlanTicket, StagePayload } from '../../../lib/planning';
import { Button, Field, fieldDescribedBy, Input, ItemKey, Modal, SearchIcon, Textarea } from '../../../ui';
import { matchesTicket, ticketStatusLabel } from './planningLogic';

type DateErrors = { name?: string; startDate?: string; endDate?: string };

function validateDates(name: string, startDate: string, endDate: string): DateErrors {
  const errors: DateErrors = {};
  if (!name.trim()) {
    errors.name = 'Escribe un nombre.';
  }
  if (!startDate) {
    errors.startDate = 'Elige la fecha de inicio.';
  }
  if (!endDate) {
    errors.endDate = 'Elige la fecha de fin.';
  } else if (startDate && endDate < startDate) {
    errors.endDate = 'La fecha de fin no puede ser anterior a la de inicio.';
  }
  return errors;
}

/** Crear o editar una etapa (hito). onSubmit rechaza si falla; quien llama muestra el aviso. */
export function StageFormModal({
  stage,
  onSubmit,
  onClose,
}: {
  stage?: PlanStage;
  onSubmit: (payload: StagePayload) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(stage?.code ?? '');
  const [name, setName] = useState(stage?.name ?? '');
  const [ownerName, setOwnerName] = useState(stage?.ownerName ?? '');
  const [startDate, setStartDate] = useState(stage?.startDate ?? '');
  const [endDate, setEndDate] = useState(stage?.endDate ?? '');
  const [deliverables, setDeliverables] = useState(stage?.deliverables ?? '');
  const [exitCriteria, setExitCriteria] = useState(stage?.exitCriteria ?? '');
  const [errors, setErrors] = useState<DateErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const next = validateDates(name, startDate, endDate);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        code: code.trim() || null,
        name: name.trim(),
        ownerName: ownerName.trim() || null,
        startDate,
        endDate,
        deliverables: deliverables.trim() || null,
        exitCriteria: exitCriteria.trim() || null,
      });
      onClose();
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={stage ? 'Editar etapa' : 'Nueva etapa'}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {stage ? 'Guardar etapa' : 'Crear etapa'}
          </Button>
        </>
      }
    >
      <form className="qp-form" onSubmit={submit} noValidate>
        <div className="qp-form-row qp-form-row--code">
          <Field id="stage-code" label="Código" optional hint="Ej. I1, Fase 2.">
            <Input id="stage-code" value={code} maxLength={20} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <Field id="stage-name" label="Nombre" error={errors.name}>
            <Input
              id="stage-name"
              value={name}
              maxLength={120}
              placeholder="Análisis y diseño detallado"
              invalid={Boolean(errors.name)}
              aria-describedby={fieldDescribedBy('stage-name', undefined, errors.name)}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        </div>
        <div className="qp-form-row">
          <Field id="stage-start" label="Inicio" error={errors.startDate}>
            <Input id="stage-start" type="date" value={startDate} invalid={Boolean(errors.startDate)} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field id="stage-end" label="Fin comprometido" error={errors.endDate}>
            <Input id="stage-end" type="date" value={endDate} invalid={Boolean(errors.endDate)} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
          <Field id="stage-owner" label="Responsable" optional>
            <Input id="stage-owner" value={ownerName} maxLength={120} placeholder="Equipo completo" onChange={(event) => setOwnerName(event.target.value)} />
          </Field>
        </div>
        <Field id="stage-deliverables" label="Entregables" optional hint="Uno por línea.">
          <Textarea id="stage-deliverables" rows={4} maxLength={8000} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} />
        </Field>
        <Field id="stage-exit" label="Cierra con" optional hint="Criterio para dar la etapa por cerrada.">
          <Textarea id="stage-exit" rows={2} maxLength={4000} value={exitCriteria} onChange={(event) => setExitCriteria(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/** Crear o editar una macroactividad dentro de una etapa. */
export function GroupFormModal({
  stage,
  group,
  onSubmit,
  onClose,
}: {
  stage: PlanStage;
  group?: PlanGroup;
  onSubmit: (payload: GroupPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [ownerName, setOwnerName] = useState(group?.ownerName ?? '');
  const [startDate, setStartDate] = useState(group?.startDate ?? stage.startDate);
  const [endDate, setEndDate] = useState(group?.endDate ?? stage.endDate);
  const [errors, setErrors] = useState<DateErrors>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const next = validateDates(name, startDate, endDate);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), ownerName: ownerName.trim() || null, startDate, endDate });
      onClose();
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={group ? 'Editar macroactividad' : `Nueva macroactividad · ${stage.code ?? stage.name}`}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={() => void submit()}>
            {group ? 'Guardar' : 'Crear macroactividad'}
          </Button>
        </>
      }
    >
      <form className="qp-form" onSubmit={submit} noValidate>
        <Field id="group-name" label="Nombre" error={errors.name}>
          <Input
            id="group-name"
            value={name}
            maxLength={120}
            placeholder="1. Plan y dependencias"
            invalid={Boolean(errors.name)}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <div className="qp-form-row">
          <Field id="group-start" label="Inicio" error={errors.startDate}>
            <Input id="group-start" type="date" value={startDate} invalid={Boolean(errors.startDate)} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field id="group-end" label="Fin" error={errors.endDate}>
            <Input id="group-end" type="date" value={endDate} invalid={Boolean(errors.endDate)} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
        <Field id="group-owner" label="Responsable" optional>
          <Input id="group-owner" value={ownerName} maxLength={120} onChange={(event) => setOwnerName(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/** Elegir tickets sin planificar para una macroactividad. */
export function AddTicketsModal({
  group,
  stageInProgress,
  tickets,
  onSubmit,
  onClose,
}: {
  group: PlanGroup;
  /** La etapa ya empezó: lo que se agregue cuenta como alcance agregado. */
  stageInProgress: boolean;
  tickets: PlanTicket[];
  onSubmit: (selected: PlanTicket[]) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const visible = tickets.filter((ticket) => matchesTicket(ticket, query));
  const keyOf = (ticket: PlanTicket) => `${ticket.type}:${ticket.id}`;

  const toggle = (ticket: PlanTicket) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(keyOf(ticket))) {
        next.delete(keyOf(ticket));
      } else {
        next.add(keyOf(ticket));
      }
      return next;
    });

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit(tickets.filter((ticket) => selected.has(keyOf(ticket))));
      onClose();
    } catch {
      // El aviso lo muestra quien llama.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`Agregar tickets a ${group.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} disabled={selected.size === 0} onClick={() => void submit()}>
            {selected.size === 0 ? 'Agregar' : `Agregar ${selected.size}`}
          </Button>
        </>
      }
    >
      <div className="qp-form">
        {stageInProgress ? (
          <p className="qp-warning" role="status">
            Esta etapa ya está en curso: lo que agregues contará como alcance agregado y bajará su porcentaje de avance.
          </p>
        ) : null}
        <label className="qx-search">
          <SearchIcon size={16} />
          <span className="sr-only">Buscar tickets sin planificar</span>
          <Input type="search" value={query} placeholder="Buscar por clave o título" onChange={(event) => setQuery(event.target.value)} />
        </label>
        {tickets.length === 0 ? <p className="qp-muted">No hay tickets sin planificar en este proyecto.</p> : null}
        <ul className="qp-pick-list">
          {visible.map((ticket) => (
            <li key={keyOf(ticket)}>
              <label className="qp-pick">
                <input type="checkbox" checked={selected.has(keyOf(ticket))} onChange={() => toggle(ticket)} />
                <ItemKey itemType={ticket.type === 'BUG' ? 'bug' : 'task'} value={ticket.itemKey ?? '—'} />
                <span className="qp-pick-title">{ticket.title}</span>
                <span className="qp-muted">{ticketStatusLabel(ticket.status)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

/** Confirmación para borrar una etapa o macroactividad (los tickets no se borran). */
export function ConfirmDeleteModal({
  title,
  message,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch {
                // El aviso lo muestra quien llama.
              } finally {
                setBusy(false);
              }
            }}
          >
            Eliminar
          </Button>
        </>
      }
    >
      <p className="qp-muted">{message}</p>
    </Modal>
  );
}
