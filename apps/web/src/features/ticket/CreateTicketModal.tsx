import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import type { PlanningView } from '../../lib/planning';
import type { ProjectMember } from '../../lib/project-members';
import { Button, Field, fieldDescribedBy, Input, Modal, Select, Textarea } from '../../ui';
import { EnvironmentPicker, FileDrop, PriorityPicker } from './fields';
import { PlanningNotice, StageSelect } from './planningFields';
import type { TicketRef } from './planningFields';
import type { Destination, NewBugValues, NewTaskValues, Priority } from './types';
import './ticket.css';

type Common = {
  members: ProjectMember[];
  activeSprintName: string | null;
  submitting: boolean;
  onClose: () => void;
  /** Planning del proyecto: selector de etapa y avisos de impacto. */
  planning?: PlanningView;
  /** Tickets que pueden ser padre (de primer nivel) para crear una subtarea. */
  parentOptions?: TicketRef[];
};

type CreateTicketModalProps =
  | (Common & { type: 'task'; onSubmit: (values: NewTaskValues, files: File[], destination: Destination) => void })
  | (Common & { type: 'bug'; onSubmit: (values: NewBugValues, files: File[], destination: Destination) => void });

type Errors = Partial<Record<'title' | 'description', string>>;

function DestinationPicker({
  value,
  onChange,
  activeSprintName,
}: {
  value: Destination;
  onChange: (value: Destination) => void;
  activeSprintName: string | null;
}) {
  const name = useId();
  const options: Array<{ value: Destination; label: string }> = [
    { value: 'backlog', label: 'Backlog general' },
    { value: 'next', label: 'Próximo Sprint' },
    ...(activeSprintName ? [{ value: 'sprint' as const, label: `${activeSprintName} (en curso)` }] : []),
  ];

  return (
    <fieldset className="qt-choice">
      <legend className="q-field__label">¿Dónde va?</legend>
      <div className="qt-chips">
        {options.map((option) => (
          <label key={option.value} className={value === option.value ? 'is-selected' : undefined}>
            <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CreateTicketModal(props: CreateTicketModalProps) {
  const { type, members, activeSprintName, submitting, onClose, planning, parentOptions = [] } = props;
  const isBug = type === 'bug';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [stageGroupId, setStageGroupId] = useState('');
  const [parent, setParent] = useState('');
  const [environment, setEnvironment] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [destination, setDestination] = useState<Destination>('backlog');
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  const clear = (field: keyof Errors) => setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (title.trim().length < 3) {
      next.title = 'Escribe un título de al menos 3 caracteres.';
    }
    if (isBug && description.trim().length < 8) {
      next.description = 'Cuenta cómo reproducirlo (al menos 8 caracteres).';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      return;
    }

    // Una subtarea hereda la etapa de su padre: no se envía la propia.
    const planningValues = { startDate, stageGroupId: parent ? '' : stageGroupId, parent };

    if (props.type === 'task') {
      props.onSubmit(
        { title: title.trim(), description: description.trim(), priority, assignedTo, dueDate, ...planningValues },
        files,
        destination,
      );
      return;
    }
    props.onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        priority,
        environment: environment.trim(),
        expectedResult: expectedResult.trim(),
        actualResult: actualResult.trim(),
        dueDate,
        ...planningValues,
      },
      files,
      destination,
    );
  };

  const formId = isBug ? 'create-bug-form' : 'create-task-form';

  return (
    <Modal
      open
      size="lg"
      title={isBug ? 'Reportar bug' : 'Nueva tarea'}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" form={formId} loading={submitting}>
            {submitting ? (isBug ? 'Reportando…' : 'Creando…') : isBug ? 'Reportar bug' : 'Crear tarea'}
          </Button>
        </>
      }
    >
      <form id={formId} className="qt-form" onSubmit={submit} noValidate>
        <Field id="ticket-title" label="Título" error={errors.title}>
          <Input
            id="ticket-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              clear('title');
            }}
            placeholder={isBug ? 'Qué falla, en pocas palabras' : 'Por ejemplo, regresión del checkout'}
            maxLength={200}
            invalid={Boolean(errors.title)}
            aria-describedby={fieldDescribedBy('ticket-title', undefined, errors.title)}
            autoComplete="off"
          />
        </Field>

        <div className="qt-row">
          <PriorityPicker value={priority} onChange={setPriority} />
          {isBug ? <EnvironmentPicker value={environment} onChange={setEnvironment} /> : null}
        </div>

        <Field
          id="ticket-description"
          label={isBug ? 'Pasos para reproducir' : 'Descripción'}
          optional={!isBug}
          hint={isBug ? 'Numera los pasos: 1. Ir al checkout… 2. Elegir tarjeta guardada…' : 'Qué hay que probar y cuándo está terminado.'}
          error={errors.description}
        >
          <Textarea
            id="ticket-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              clear('description');
            }}
            rows={4}
            maxLength={4000}
            invalid={Boolean(errors.description)}
            aria-describedby={fieldDescribedBy('ticket-description', 'x', errors.description)}
          />
        </Field>

        {isBug ? (
          <div className="qt-compare">
            <Field id="ticket-expected" label="Resultado esperado" optional>
              <Textarea
                id="ticket-expected"
                className="qt-expected"
                value={expectedResult}
                onChange={(event) => setExpectedResult(event.target.value)}
                rows={3}
                placeholder="Qué debía pasar"
                maxLength={4000}
              />
            </Field>
            <Field id="ticket-actual" label="Resultado obtenido" optional>
              <Textarea
                id="ticket-actual"
                className="qt-actual"
                value={actualResult}
                onChange={(event) => setActualResult(event.target.value)}
                rows={3}
                placeholder="Qué pasó en realidad"
                maxLength={4000}
              />
            </Field>
          </div>
        ) : null}

        {isBug ? (
          <Field id="ticket-due" label="Fecha límite" optional>
            <Input id="ticket-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        ) : (
          <div className="qt-row">
            <Field id="ticket-assignee" label="Responsable" optional>
              <Select id="ticket-assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                <option value="">Sin asignar</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name?.trim() || member.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="ticket-due" label="Fecha objetivo" optional>
              <Input id="ticket-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
          </div>
        )}

        <DestinationPicker value={destination} onChange={setDestination} activeSprintName={activeSprintName} />

        <div className="qt-row">
          <Field id="ticket-start" label="Fecha de inicio" optional>
            <Input id="ticket-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          {parent ? null : <StageSelect id="ticket-stage" plan={planning} value={stageGroupId} onChange={setStageGroupId} />}
        </div>
        {parentOptions.length > 0 ? (
          <Field id="ticket-parent" label="Subtarea de" optional hint="Una subtarea es una dependencia: no amplía el alcance de la etapa.">
            <Select id="ticket-parent" value={parent} onChange={(event) => setParent(event.target.value)}>
              <option value="">No es subtarea</option>
              {parentOptions.map((option) => (
                <option key={`${option.type}:${option.id}`} value={`${option.type === 'bug' ? 'BUG' : 'TASK'}:${option.id}`}>
                  {option.itemKey ? `${option.itemKey} · ` : ''}
                  {option.title}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <PlanningNotice plan={planning} groupId={stageGroupId} isNew isSubtask={Boolean(parent)} />

        <FileDrop files={files} onChange={setFiles} label={isBug ? 'Evidencias' : 'Adjuntos'} />
      </form>
    </Modal>
  );
}
