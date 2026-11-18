import { useMemo, useRef, useState } from 'react';

import type { WorkItemAttachment } from '../../lib/attachments';
import type { Bug } from '../../lib/bugs';
import type { WorkItemComment } from '../../lib/comments';
import type { PlanningView } from '../../lib/planning';
import type { ProjectMember } from '../../lib/project-members';
import type { Task } from '../../lib/tasks';
import { Avatar, Button, Field, Input, Modal, Select, StatusBadge, Textarea } from '../../ui';
import { EnvironmentPicker, PriorityPicker } from './fields';
import { buildActivity, formatEventTime } from './historyLogic';
import { PlanningNotice, StageSelect, SubtasksSection } from './planningFields';
import type { TicketRef } from './planningFields';
import { openSubtasksMessage } from './subtaskLogic';
import type { HistoryEntry } from './historyLogic';
import { ATTACHMENTS_ACCEPT } from './types';
import './ticket.css';
import type { Priority } from './types';

type Section = 'NEXT_SPRINT' | 'GENERAL_BACKLOG' | 'SPRINT_BOARD';

export type TicketSavePayload =
  | {
      type: 'task';
      id: string;
      title: string;
      description: string;
      priority: Priority;
      status: 'TODO' | 'IN_PROGRESS' | 'DONE';
      section: Section;
      assignedTo: string | null;
      dueDate: string | null;
      startDate: string | null;
      /** undefined en subtareas: heredan la etapa del padre. */
      stageGroupId?: string | null;
      changeNote: string;
    }
  | {
      type: 'bug';
      id: string;
      title: string;
      description: string;
      priority: Priority;
      status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
      section: Section;
      environment: string;
      expectedResult: string;
      actualResult: string;
      dueDate: string | null;
      startDate: string | null;
      stageGroupId?: string | null;
      changeNote: string;
    };

type TicketDetailModalProps = {
  item: { type: 'task'; data: Task } | { type: 'bug'; data: Bug };
  members: ProjectMember[];
  activeSprintName: string | null;
  attachments: WorkItemAttachment[];
  attachmentPreviewUrls: Record<string, string>;
  loadingAttachments: boolean;
  history: HistoryEntry[];
  loadingHistory: boolean;
  /** Comentarios del ticket. Sin onAddComment la sección no se muestra. */
  comments?: WorkItemComment[];
  loadingComments?: boolean;
  /** Rechaza la promesa si falla; quien llama muestra el aviso. */
  onAddComment?: (body: string) => Promise<void>;
  /** Planning del proyecto: opciones de etapa y aviso de impacto. */
  planning?: PlanningView;
  /** Si es subtarea: su ticket padre. */
  parent?: TicketRef | null;
  subtasks?: TicketRef[];
  onOpenTicket?: (ticket: { type: 'task' | 'bug'; id: string }) => void;
  /** Rechaza si falla; quien llama muestra el aviso. Sin esta prop no se ofrece crear subtareas. */
  onAddSubtask?: (input: { type: 'task' | 'bug'; title: string }) => Promise<void>;
  saving: boolean;
  onSave: (payload: TicketSavePayload) => Promise<void> | void;
  onAddAttachments: (files: File[]) => Promise<void>;
  onClose: () => void;
};

const TASK_STATUSES = [
  ['TODO', 'Pendiente'],
  ['IN_PROGRESS', 'En progreso'],
  ['DONE', 'Hecho'],
] as const;
const BUG_STATUSES = [
  ['OPEN', 'Bug abierto'],
  ['IN_PROGRESS', 'En progreso'],
  ['RESOLVED', 'Resuelto'],
  ['CLOSED', 'Cerrado'],
] as const;
const FINISHED = new Set(['DONE', 'RESOLVED', 'CLOSED']);

const dateOnly = (value: string | null) => (value ? value.slice(0, 10) : '');
const formatDay = (value: string) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)).replace('.', '');

function locationLabel(section: Section, activeSprintName: string | null): string {
  if (section === 'SPRINT_BOARD') {
    return activeSprintName ? `Tablero · ${activeSprintName}` : 'Tablero del sprint';
  }
  return section === 'NEXT_SPRINT' ? 'Próximo Sprint' : 'Backlog general';
}

export function TicketDetailModal({
  item,
  members,
  activeSprintName,
  attachments,
  attachmentPreviewUrls,
  loadingAttachments,
  history,
  loadingHistory,
  comments = [],
  loadingComments = false,
  onAddComment,
  planning,
  parent = null,
  subtasks = [],
  onOpenTicket,
  onAddSubtask,
  saving,
  onSave,
  onAddAttachments,
  onClose,
}: TicketDetailModalProps) {
  const isTask = item.type === 'task';
  const data = item.data;
  const original = {
    title: data.title,
    description: data.description ?? '',
    priority: data.priority as Priority,
    status: data.status as string,
    assignedTo: isTask ? (item.data.assignedTo ?? '') : '',
    dueDate: dateOnly(item.data.dueDate),
    startDate: dateOnly(item.data.startDate ?? null),
    stageGroupId: item.data.stageGroupId ?? '',
    environment: !isTask ? (item.data.environment ?? '') : '',
    expectedResult: !isTask ? (item.data.expectedResult ?? '') : '',
    actualResult: !isTask ? (item.data.actualResult ?? '') : '',
  };

  const [form, setForm] = useState(original);
  const [changeNote, setChangeNote] = useState('');
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof original>(key: K, value: (typeof original)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setConfirmingClose(false);
  };

  const dirty =
    (Object.keys(original) as Array<keyof typeof original>).some((key) => String(form[key]).trim() !== String(original[key]).trim()) ||
    changeNote.trim().length > 0;
  const reopening = FINISHED.has(original.status) && !FINISHED.has(form.status);
  const isSubtask = Boolean(parent);
  const closingBlocked = !FINISHED.has(original.status) && FINISHED.has(form.status) ? openSubtasksMessage(subtasks) : null;
  const memberName = (userId: string) => {
    const member = members.find((candidate) => candidate.userId === userId);
    return member ? member.name?.trim() || member.email : null;
  };
  const activity = useMemo(
    () => buildActivity(history, { itemType: item.type, memberName }),
    // memberName depende solo de members
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, item.type, members],
  );
  const creatorId = isTask ? item.data.createdBy : item.data.reportedBy;
  const creator = memberName(creatorId) ?? 'Alguien del equipo';

  const requestClose = () => {
    if (dirty && !saving) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  // Tras guardar, la nota se limpia (si no, el modal seguiría marcando cambios pendientes).
  const persist = (payload: TicketSavePayload) =>
    Promise.resolve(onSave(payload)).then(
      () => setChangeNote(''),
      () => undefined,
    );

  const save = () => {
    const common = {
      id: data.id,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      section: data.section as Section,
      changeNote: changeNote.trim(),
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      ...(isSubtask ? {} : { stageGroupId: form.stageGroupId || null }),
    };
    if (isTask) {
      void persist({
        ...common,
        type: 'task',
        status: form.status as 'TODO' | 'IN_PROGRESS' | 'DONE',
        assignedTo: form.assignedTo || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      });
      return;
    }
    void persist({
      ...common,
      type: 'bug',
      status: form.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
      environment: form.environment.trim(),
      expectedResult: form.expectedResult.trim(),
      actualResult: form.actualResult.trim(),
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
    });
  };

  const sendComment = async () => {
    const body = commentDraft.trim();
    if (!body || !onAddComment) {
      return;
    }
    setSendingComment(true);
    try {
      await onAddComment(body);
      setCommentDraft('');
    } catch {
      // El aviso lo muestra quien llama; el borrador se conserva.
    } finally {
      setSendingComment(false);
    }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) {
      return;
    }
    setUploading(true);
    try {
      await onAddAttachments(Array.from(list));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`${isTask ? 'Tarea' : 'Bug'} ${data.itemKey ?? ''}`.trim()}
      aside={<StatusBadge status={original.status} itemType={item.type} />}
      onClose={requestClose}
      closeOnBackdrop={false}
      footer={
        <div className="qt-footer">
          {confirmingClose ? (
            <div className="qt-confirm" role="alert">
              <span>Tienes cambios sin guardar.</span>
              <Button size="sm" onClick={() => setConfirmingClose(false)}>
                Seguir editando
              </Button>
              <Button size="sm" variant="danger" onClick={onClose}>
                Descartar
              </Button>
            </div>
          ) : (
            <>
              <Input
                aria-label="Nota del cambio"
                className="qt-note"
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Nota del cambio (opcional)"
                maxLength={300}
              />
              <Button onClick={requestClose}>Cerrar</Button>
              <Button variant="primary" onClick={save} loading={saving} disabled={!dirty || form.title.trim().length < 3}>
                {dirty ? 'Guardar cambios' : 'Sin cambios'}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="qt-detail">
        <div className="qt-main">
          <div className="qt-heading">
            <label className="sr-only" htmlFor="ticket-detail-title">
              Título
            </label>
            {/* Textarea que crece con el texto: un título largo se lee completo, sin cortarse. */}
            <textarea
              id="ticket-detail-title"
              className="qt-title-input"
              value={form.title}
              onChange={(event) => set('title', event.target.value.replace(/\n/g, ' '))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                }
              }}
              rows={2}
              maxLength={200}
            />
          </div>

          <Field id="ticket-detail-description" label={isTask ? 'Descripción' : 'Pasos para reproducir'}>
            <Textarea
              id="ticket-detail-description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={isTask ? 'Qué hay que probar y cuándo está terminado.' : undefined}
            />
          </Field>

          {!isTask ? (
            <div className="qt-compare">
              <Field id="ticket-detail-expected" label="Resultado esperado">
                <Textarea
                  id="ticket-detail-expected"
                  className="qt-expected"
                  value={form.expectedResult}
                  onChange={(event) => set('expectedResult', event.target.value)}
                  rows={3}
                />
              </Field>
              <Field id="ticket-detail-actual" label="Resultado obtenido">
                <Textarea
                  id="ticket-detail-actual"
                  className="qt-actual"
                  value={form.actualResult}
                  onChange={(event) => set('actualResult', event.target.value)}
                  rows={3}
                />
              </Field>
            </div>
          ) : null}

          {!isSubtask ? (
            <SubtasksSection
              subtasks={subtasks}
              onOpen={onOpenTicket ? (ticket) => onOpenTicket({ type: ticket.type, id: ticket.id }) : undefined}
              onAdd={onAddSubtask}
            />
          ) : null}

          <section className="qt-block" aria-label={isTask ? 'Adjuntos' : 'Evidencias'}>
            <h3 className="q-field__label">{isTask ? 'Adjuntos' : 'Evidencias'}</h3>
            <div className="qt-attachments">
              {loadingAttachments ? <span className="qt-muted">Cargando archivos…</span> : null}
              {attachments.map((attachment) => {
                const url = attachmentPreviewUrls[attachment.id];
                const isImage = attachment.mimeType.startsWith('image/');
                return (
                  <a
                    key={attachment.id}
                    className="qt-attachment"
                    href={url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    title={attachment.fileName}
                  >
                    {isImage && url ? <img src={url} alt="" /> : <span className="qt-attachment-type">{attachment.fileName.split('.').pop()?.toUpperCase()}</span>}
                    <span className="qt-attachment-name">{attachment.fileName}</span>
                  </a>
                );
              })}
              <button type="button" className="qt-attachment qt-attachment--add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Subiendo…' : '+ Agregar'}
              </button>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                multiple
                accept={ATTACHMENTS_ACCEPT}
                aria-label="Agregar archivos"
                onChange={(event) => {
                  void addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
          </section>

          {onAddComment ? (
            <section className="qt-block" aria-label="Comentarios">
              <h3 className="q-field__label">
                Comentarios{comments.length > 0 ? <span className="qt-count" aria-hidden="true">{comments.length}</span> : null}
              </h3>
              {loadingComments ? <p className="qt-muted">Cargando comentarios…</p> : null}
              {comments.length > 0 ? (
                <ol className="qt-comments">
                  {comments.map((comment) => {
                    const author = comment.authorName?.trim() || comment.authorEmail;
                    return (
                      <li key={comment.id}>
                        <Avatar name={author} src={comment.authorAvatarUrl} size={26} />
                        <div>
                          <p className="qt-comment-head">
                            <strong>{author}</strong>
                            {comment.apiTokenName ? <span className="qt-via">vía {comment.apiTokenName}</span> : null}
                            <time dateTime={comment.createdAt}>{formatEventTime(comment.createdAt)}</time>
                          </p>
                          <p className="qt-comment-body">{comment.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
              <div className="qt-comment-form">
                <label className="sr-only" htmlFor="ticket-comment">
                  Escribe un comentario
                </label>
                <Textarea
                  id="ticket-comment"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      void sendComment();
                    }
                  }}
                  rows={2}
                  maxLength={5000}
                  placeholder="Escribe un comentario…"
                />
                <Button size="sm" variant="primary" onClick={() => void sendComment()} loading={sendingComment} disabled={!commentDraft.trim()}>
                  Comentar
                </Button>
              </div>
            </section>
          ) : null}

          <section className="qt-block" aria-label="Actividad">
            <h3 className="q-field__label">Actividad</h3>
            {loadingHistory ? <p className="qt-muted">Cargando actividad…</p> : null}
            <ol className="qt-activity">
              {activity.map((event) => (
                <li key={event.id}>
                  <Avatar name={event.actorName} size={26} />
                  <div>
                    {event.lines.map((line, index) => (
                      <p key={index}>
                        {index === 0 ? <strong>{event.actorName.split(' ')[0]} </strong> : null}
                        {line.map((part, partIndex) => (part.strong ? <strong key={partIndex}>{part.text}</strong> : <span key={partIndex}>{part.text}</span>))}
                      </p>
                    ))}
                    <time dateTime={event.at}>{formatEventTime(event.at)}</time>
                    {event.via ? <span className="qt-via">vía {event.via}</span> : null}
                    {event.note ? <q>{event.note}</q> : null}
                  </div>
                </li>
              ))}
              <li>
                <Avatar name={creator} size={26} />
                <div>
                  <p>
                    <strong>{creator.split(' ')[0]} </strong>
                    {isTask ? 'creó la tarea' : 'reportó el bug'}
                  </p>
                  <time dateTime={data.createdAt}>{formatEventTime(data.createdAt)}</time>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <aside className="qt-side" aria-label="Propiedades">
          <Field id="ticket-detail-status" label="Estado" hint={reopening ? 'Al reabrirlo, el ticket vuelve al backlog general.' : undefined}>
            <Select id="ticket-detail-status" value={form.status} onChange={(event) => set('status', event.target.value)}>
              {(isTask ? TASK_STATUSES : BUG_STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {closingBlocked ? (
            <p className="qt-notice qt-notice--warn" role="alert">
              {closingBlocked}
            </p>
          ) : null}

          <PriorityPicker value={form.priority} onChange={(value) => set('priority', value)} />

          {isTask ? (
            <>
              <Field id="ticket-detail-assignee" label="Responsable">
                <Select id="ticket-detail-assignee" value={form.assignedTo} onChange={(event) => set('assignedTo', event.target.value)}>
                  <option value="">Sin asignar</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name?.trim() || member.email}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="ticket-detail-due" label="Fecha objetivo">
                <Input id="ticket-detail-due" type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <EnvironmentPicker value={form.environment} onChange={(value) => set('environment', value)} />
              <Field id="ticket-detail-due" label="Fecha límite">
                <Input id="ticket-detail-due" type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} />
              </Field>
            </>
          )}

          <Field id="ticket-detail-start" label="Fecha de inicio">
            <Input id="ticket-detail-start" type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} />
          </Field>

          {isSubtask && parent ? (
            <div className="q-field">
              <span className="q-field__label">Etapa</span>
              <p className="qt-muted">
                Subtarea de{' '}
                <button type="button" className="qt-link" onClick={() => onOpenTicket?.({ type: parent.type, id: parent.id })}>
                  {parent.itemKey ?? parent.title}
                </button>
                ; hereda su etapa.
              </p>
            </div>
          ) : (
            <>
              <StageSelect id="ticket-detail-stage" plan={planning} value={form.stageGroupId} onChange={(value) => set('stageGroupId', value)} />
              {form.stageGroupId !== original.stageGroupId ? (
                <PlanningNotice plan={planning} groupId={form.stageGroupId} currentGroupId={original.stageGroupId || null} />
              ) : null}
            </>
          )}

          <dl className="qt-facts">
            <div>
              <dt>Ubicación</dt>
              <dd>{locationLabel(data.section as Section, activeSprintName)}</dd>
            </div>
            <div>
              <dt>{isTask ? 'Creada por' : 'Reportado por'}</dt>
              <dd>
                {creator} · {formatDay(data.createdAt)}
              </dd>
            </div>
            <div>
              <dt>Última edición</dt>
              <dd>{formatEventTime(data.updatedAt)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </Modal>
  );
}
