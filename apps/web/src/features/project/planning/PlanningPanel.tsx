import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getApiErrorMessage } from '../../../lib/apiErrors';
import {
  assignTicketToGroup,
  createGroup,
  createStage,
  deleteGroup,
  deleteStage,
  getPlanning,
  updateGroup,
  updateStage,
} from '../../../lib/planning';
import type { PlanGroup, PlanningView, PlanStage, PlanTicket, ProgressStats } from '../../../lib/planning';
import { Button, Card, EmptyState, ItemKey, PlusIcon, StatusBadge, useToast } from '../../../ui';
import { AddTicketsModal, ConfirmDeleteModal, GroupFormModal, StageFormModal } from './PlanningForms';
import {
  forecastLabel,
  formatPlanDate,
  formatRange,
  addsScopeToday,
  PLAN_STATUS,
  planningQueryKey,
  progressLabel,
  ticketStatusLabel,
} from './planningLogic';
import './planning.css';

type PlanningPanelProps = {
  accessToken: string;
  projectId: string;
  onOpenTicket: (ticket: { type: 'task' | 'bug'; id: string }) => void;
};

type Dialog =
  | { kind: 'stage'; stage?: PlanStage }
  | { kind: 'group'; stage: PlanStage; group?: PlanGroup }
  | { kind: 'add-tickets'; stage: PlanStage; group: PlanGroup }
  | { kind: 'delete-stage'; stage: PlanStage }
  | { kind: 'delete-group'; group: PlanGroup }
  | null;

export function PlanningPanel({ accessToken, projectId, onOpenTicket }: PlanningPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);

  const planningQuery = useQuery({
    queryKey: planningQueryKey(projectId),
    queryFn: () => getPlanning(accessToken, projectId),
    enabled: Boolean(accessToken && projectId),
    retry: false,
  });

  // Ejecuta un cambio, muestra el aviso y refresca el plan y las listas de tickets.
  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planningQueryKey(projectId) }),
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['bugs', projectId] }),
      ]);
      toast(success);
    } catch (error) {
      toast(getApiErrorMessage(error), 'error');
      throw error;
    }
  };

  const openTicket = (ticket: PlanTicket) => onOpenTicket({ type: ticket.type === 'BUG' ? 'bug' : 'task', id: ticket.id });

  if (planningQuery.isLoading) {
    return <p className="qp-muted">Cargando planning…</p>;
  }
  if (planningQuery.isError || !planningQuery.data) {
    return (
      <Card>
        <p className="qp-muted">No pudimos cargar el planning. {getApiErrorMessage(planningQuery.error)}</p>
        <Button size="sm" onClick={() => planningQuery.refetch()}>
          Reintentar
        </Button>
      </Card>
    );
  }

  const plan = planningQuery.data;
  const currentYear = Number(plan.today.slice(0, 4));

  return (
    <div className="qp">
      {plan.stages.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            title="Este proyecto aún no tiene planning"
            description="Crea las etapas (hitos) con sus fechas comprometidas y vincula los tickets a sus macroactividades. El avance y el riesgo de cada etapa se calculan solos a partir de los tickets."
            action={
              <Button size="sm" variant="primary" icon={<PlusIcon size={16} />} onClick={() => setDialog({ kind: 'stage' })}>
                Crear primera etapa
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <ProjectSummary plan={plan} currentYear={currentYear} onNewStage={() => setDialog({ kind: 'stage' })} />
          {plan.stages.map((stage, index) => (
            <StageCard
              key={stage.id}
              stage={stage}
              today={plan.today}
              currentYear={currentYear}
              isFirst={index === 0}
              isLast={index === plan.stages.length - 1}
              onOpenTicket={openTicket}
              onEdit={() => setDialog({ kind: 'stage', stage })}
              onDelete={() => setDialog({ kind: 'delete-stage', stage })}
              onMove={(move) => run(() => updateStage(accessToken, stage.id, { move }), 'Orden actualizado.').catch(() => undefined)}
              onNewGroup={() => setDialog({ kind: 'group', stage })}
              onEditGroup={(group) => setDialog({ kind: 'group', stage, group })}
              onDeleteGroup={(group) => setDialog({ kind: 'delete-group', group })}
              onMoveGroup={(group, move) =>
                run(() => updateGroup(accessToken, group.id, { move }), 'Orden actualizado.').catch(() => undefined)
              }
              onAddTickets={(group) => setDialog({ kind: 'add-tickets', stage, group })}
              onRemoveTicket={(ticket) =>
                run(() => assignTicketToGroup(accessToken, ticket, null), `${ticket.itemKey ?? 'Ticket'} quedó sin planificar.`).catch(
                  () => undefined,
                )
              }
            />
          ))}
        </>
      )}

      <UnplannedSection
        tickets={plan.unplannedTickets}
        hasStages={plan.stages.length > 0}
        currentYear={currentYear}
        onOpenTicket={openTicket}
      />

      {dialog?.kind === 'stage' ? (
        <StageFormModal
          stage={dialog.stage}
          onClose={() => setDialog(null)}
          onSubmit={(payload) =>
            dialog.stage
              ? run(() => updateStage(accessToken, dialog.stage!.id, payload), 'Etapa actualizada.')
              : run(() => createStage(accessToken, projectId, payload), 'Etapa creada.')
          }
        />
      ) : null}
      {dialog?.kind === 'group' ? (
        <GroupFormModal
          stage={dialog.stage}
          group={dialog.group}
          onClose={() => setDialog(null)}
          onSubmit={(payload) =>
            dialog.group
              ? run(() => updateGroup(accessToken, dialog.group!.id, payload), 'Macroactividad actualizada.')
              : run(() => createGroup(accessToken, dialog.stage.id, payload), 'Macroactividad creada.')
          }
        />
      ) : null}
      {dialog?.kind === 'add-tickets' ? (
        <AddTicketsModal
          group={dialog.group}
          stageInProgress={addsScopeToday(dialog.stage, plan.today)}
          tickets={plan.unplannedTickets}
          onClose={() => setDialog(null)}
          onSubmit={(selected) =>
            run(
              () => Promise.all(selected.map((ticket) => assignTicketToGroup(accessToken, ticket, dialog.group.id))),
              selected.length === 1 ? 'Ticket agregado a la macroactividad.' : `${selected.length} tickets agregados.`,
            )
          }
        />
      ) : null}
      {dialog?.kind === 'delete-stage' ? (
        <ConfirmDeleteModal
          title={`Eliminar etapa ${dialog.stage.code ?? dialog.stage.name}`}
          message="Se eliminan la etapa y sus macroactividades. Los tickets no se borran: quedan sin planificar."
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => deleteStage(accessToken, dialog.stage.id), 'Etapa eliminada.')}
        />
      ) : null}
      {dialog?.kind === 'delete-group' ? (
        <ConfirmDeleteModal
          title={`Eliminar ${dialog.group.name}`}
          message="Se elimina la macroactividad. Sus tickets no se borran: quedan sin planificar."
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => deleteGroup(accessToken, dialog.group.id), 'Macroactividad eliminada.')}
        />
      ) : null}
    </div>
  );
}

function ProjectSummary({ plan, currentYear, onNewStage }: { plan: PlanningView; currentYear: number; onNewStage: () => void }) {
  const { project } = plan;
  const atRisk = plan.stages.filter((stage) => stage.stats.status === 'AT_RISK' || stage.stats.status === 'DELAYED');

  return (
    <Card className="qp-summary">
      <div className="qp-summary-stats">
        <div>
          <span className="qp-label">Avance general</span>
          <strong className="qp-big">{project.overallPct === null ? '—' : `${project.overallPct}%`}</strong>
        </div>
        <div>
          <span className="qp-label">Fin planeado</span>
          <strong>{formatPlanDate(project.plannedEnd, currentYear)}</strong>
        </div>
        <div>
          <span className="qp-label">Fin proyectado</span>
          <strong className={project.slipDays > 0 ? 'qp-late' : undefined}>{formatPlanDate(project.forecastEnd, currentYear)}</strong>
        </div>
      </div>
      {project.slipDays > 0 ? (
        <p className="qp-alert" role="status">
          Posible desfase de <strong>{project.slipDays} {project.slipDays === 1 ? 'día hábil' : 'días hábiles'}</strong> por{' '}
          {atRisk.map((stage) => stage.code ?? stage.name).join(', ')}.
        </p>
      ) : null}
      <Button size="sm" icon={<PlusIcon size={16} />} onClick={onNewStage} className="qp-summary-action">
        Nueva etapa
      </Button>
    </Card>
  );
}

/** Barra de avance real con una marca en el avance esperado según el tiempo transcurrido. */
export function ProgressBar({ stats, compact = false }: { stats: ProgressStats; compact?: boolean }) {
  const actual = stats.actualPct ?? 0;
  const tone = PLAN_STATUS[stats.status].tone;
  return (
    <div
      className={`qp-bar qp-bar--${tone}${compact ? ' qp-bar--compact' : ''}`}
      role="img"
      aria-label={`Avance real ${stats.actualPct ?? 0}%, esperado ${stats.expectedPct}%`}
    >
      <span className="qp-bar-fill" style={{ width: `${Math.min(100, actual)}%` }} />
      {stats.status !== 'NOT_STARTED' && stats.status !== 'COMPLETED' ? (
        <span className="qp-bar-expected" style={{ left: `${stats.expectedPct}%` }} title={`Esperado hoy: ${stats.expectedPct}%`} />
      ) : null}
    </div>
  );
}

type StageCardProps = {
  stage: PlanStage;
  today: string;
  currentYear: number;
  isFirst: boolean;
  isLast: boolean;
  onOpenTicket: (ticket: PlanTicket) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (move: 'up' | 'down') => void;
  onNewGroup: () => void;
  onEditGroup: (group: PlanGroup) => void;
  onDeleteGroup: (group: PlanGroup) => void;
  onMoveGroup: (group: PlanGroup, move: 'up' | 'down') => void;
  onAddTickets: (group: PlanGroup) => void;
  onRemoveTicket: (ticket: PlanTicket) => void;
};

function StageCard(props: StageCardProps) {
  const { stage, currentYear } = props;
  const status = PLAN_STATUS[stage.stats.status];
  const forecast = forecastLabel(stage.stats, currentYear);
  const [open, setOpen] = useState(stage.stats.status !== 'COMPLETED');

  return (
    <section className="qx-section qp-stage" aria-label={`Etapa ${stage.code ?? ''} ${stage.name}`.replace(/\s+/g, ' ').trim()}>
      <header className="qp-stage-head">
        <button type="button" className="qp-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="sr-only">{open ? 'Contraer' : 'Expandir'}</span>
        </button>
        <h2>
          {stage.code ? <span className="qp-code">{stage.code}</span> : null}
          {stage.name}
        </h2>
        <StatusBadge tone={status.tone} label={status.label} />
        <div className="qp-actions">
          <Button size="sm" variant="ghost" onClick={() => props.onMove('up')} disabled={props.isFirst} aria-label="Subir etapa">
            ↑
          </Button>
          <Button size="sm" variant="ghost" onClick={() => props.onMove('down')} disabled={props.isLast} aria-label="Bajar etapa">
            ↓
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onEdit}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onDelete}>
            Eliminar
          </Button>
        </div>
      </header>

      <div className="qp-stage-body">
        <p className="qp-meta">
          <span>{formatRange(stage.startDate, stage.endDate, currentYear)}</span>
          {stage.ownerName ? <span>{stage.ownerName}</span> : null}
          <span>{progressLabel(stage.stats)}</span>
          {stage.stats.total > 0 ? (
            <span>
              Comprometido {stage.stats.committed}
              {stage.stats.added > 0 ? <strong className="qp-added"> · Agregado después +{stage.stats.added}</strong> : null}
            </span>
          ) : null}
        </p>
        <div className="qp-progress">
          <ProgressBar stats={stage.stats} />
          <span className="qp-pct">
            <strong>{stage.stats.actualPct ?? 0}%</strong>
            {stage.stats.status !== 'NOT_STARTED' && stage.stats.status !== 'COMPLETED' ? ` · esperado ${stage.stats.expectedPct}%` : ''}
          </span>
        </div>
        {forecast ? <p className={`qp-forecast${stage.stats.slipDays > 0 ? ' qp-late' : ''}`}>{forecast}</p> : null}

        {open ? (
          <>
            {stage.deliverables || stage.exitCriteria ? (
              <details className="qp-details">
                <summary>Entregables y criterio de cierre</summary>
                {stage.deliverables ? <p className="qp-pre">{stage.deliverables}</p> : null}
                {stage.exitCriteria ? (
                  <p className="qp-pre">
                    <strong>Cierra con: </strong>
                    {stage.exitCriteria}
                  </p>
                ) : null}
              </details>
            ) : null}

            {stage.groups.map((group, index) => (
              <GroupBlock
                key={group.id}
                group={group}
                currentYear={currentYear}
                isFirst={index === 0}
                isLast={index === stage.groups.length - 1}
                onOpenTicket={props.onOpenTicket}
                onEdit={() => props.onEditGroup(group)}
                onDelete={() => props.onDeleteGroup(group)}
                onMove={(move) => props.onMoveGroup(group, move)}
                onAddTickets={() => props.onAddTickets(group)}
                onRemoveTicket={props.onRemoveTicket}
              />
            ))}
            <Button size="sm" variant="ghost" icon={<PlusIcon size={16} />} onClick={props.onNewGroup} className="qp-add-group">
              Macroactividad
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

type GroupBlockProps = {
  group: PlanGroup;
  currentYear: number;
  isFirst: boolean;
  isLast: boolean;
  onOpenTicket: (ticket: PlanTicket) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (move: 'up' | 'down') => void;
  onAddTickets: () => void;
  onRemoveTicket: (ticket: PlanTicket) => void;
};

function GroupBlock({ group, currentYear, isFirst, isLast, onOpenTicket, onEdit, onDelete, onMove, onAddTickets, onRemoveTicket }: GroupBlockProps) {
  const status = PLAN_STATUS[group.stats.status];
  return (
    <div className="qp-group" role="group" aria-label={group.name}>
      <div className="qp-group-head">
        <h3>{group.name}</h3>
        <StatusBadge tone={status.tone} label={status.label} />
        <span className="qp-muted">
          {formatRange(group.startDate, group.endDate, currentYear)}
          {group.ownerName ? ` · ${group.ownerName}` : ''}
        </span>
        <div className="qp-group-progress">
          <ProgressBar stats={group.stats} compact />
          <span className="qp-pct">{group.stats.actualPct ?? 0}%</span>
        </div>
        <div className="qp-actions">
          <Button size="sm" variant="ghost" onClick={onAddTickets}>
            Agregar tickets
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onMove('up')} disabled={isFirst} aria-label={`Subir ${group.name}`}>
            ↑
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onMove('down')} disabled={isLast} aria-label={`Bajar ${group.name}`}>
            ↓
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Eliminar
          </Button>
        </div>
      </div>
      {group.tickets.length === 0 ? (
        <p className="qp-muted qp-empty-group">Sin tickets. Usa "Agregar tickets" para vincular trabajo a esta macroactividad.</p>
      ) : (
        <ul className="qp-tickets">
          {group.tickets.map((ticket) => (
            <TicketRow key={`${ticket.type}:${ticket.id}`} ticket={ticket} currentYear={currentYear} onOpen={onOpenTicket} onRemove={onRemoveTicket} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  currentYear,
  onOpen,
  onRemove,
}: {
  ticket: PlanTicket;
  currentYear: number;
  onOpen: (ticket: PlanTicket) => void;
  onRemove?: (ticket: PlanTicket) => void;
}) {
  return (
    <li className={`qp-ticket${ticket.isDone ? ' is-done' : ''}`}>
      <ItemKey itemType={ticket.type === 'BUG' ? 'bug' : 'task'} value={ticket.itemKey ?? '—'} />
      <button type="button" className="qp-ticket-title" onClick={() => onOpen(ticket)}>
        {ticket.title}
      </button>
      <span className="qp-ticket-meta">
        {ticket.subtasks.total > 0 ? (
          <span className="qp-chip" title="Subtareas cerradas">
            {ticket.subtasks.done}/{ticket.subtasks.total}
          </span>
        ) : null}
        {ticket.addedAfterStart ? (
          <span className="qp-chip qp-chip--added" title="Entró a la etapa después de iniciada">
            Agregado
          </span>
        ) : null}
        <span>{ticketStatusLabel(ticket.status)}</span>
        {ticket.startDate || ticket.dueDate ? <span>{formatRange(ticket.startDate, ticket.dueDate, currentYear)}</span> : null}
        {ticket.assigneeName ? <span>{ticket.assigneeName}</span> : null}
      </span>
      {onRemove ? (
        <button
          type="button"
          className="q-icon-btn qp-remove"
          aria-label={`Quitar ${ticket.itemKey ?? ticket.title} del planning`}
          title="Quitar del planning"
          onClick={() => onRemove(ticket)}
        >
          ×
        </button>
      ) : null}
    </li>
  );
}

function UnplannedSection({
  tickets,
  hasStages,
  currentYear,
  onOpenTicket,
}: {
  tickets: PlanTicket[];
  hasStages: boolean;
  currentYear: number;
  onOpenTicket: (ticket: PlanTicket) => void;
}) {
  const [open, setOpen] = useState(false);
  if (tickets.length === 0) {
    return null;
  }
  const pending = tickets.filter((ticket) => !ticket.isDone).length;

  return (
    <section className="qx-section qp-unplanned" aria-label="Tickets sin planificar">
      <header className="qp-stage-head">
        <button type="button" className="qp-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          <span className="sr-only">{open ? 'Contraer' : 'Expandir'}</span>
        </button>
        <h2>Tickets sin planificar</h2>
        <span className="qx-count">
          {tickets.length} · {pending} {pending === 1 ? 'pendiente' : 'pendientes'}
        </span>
      </header>
      {hasStages ? (
        <p className="qp-muted qp-unplanned-note">No cuentan para el avance de ninguna etapa. Agrégalos desde la macroactividad que corresponda.</p>
      ) : null}
      {open ? (
        <ul className="qp-tickets">
          {tickets.map((ticket) => (
            <TicketRow key={`${ticket.type}:${ticket.id}`} ticket={ticket} currentYear={currentYear} onOpen={onOpenTicket} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
