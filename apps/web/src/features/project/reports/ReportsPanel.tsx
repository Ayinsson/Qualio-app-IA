import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { getApiErrorMessage } from '../../../lib/apiErrors';
import { exportElementToPdf } from '../../../lib/pdf';
import {
  downloadMonthlyCsv,
  downloadOverviewCsv,
  downloadSprintCsv,
  getMonthlyReport,
  getOverviewReport,
  getSprintReport,
} from '../../../lib/reports';
import type { MonthlyReport, OverviewReport, SprintReport } from '../../../lib/reports';
import { listSprints } from '../../../lib/sprints';
import { Button, Input, Select, useToast } from '../../../ui';
import { formatLeadTime, formatPercent, monthSliceLabel, shortDay, weekLabel } from './chartLogic';
import { BurndownChart, ChartCard, ColumnChart, MeterList, StatTile } from './charts';
import type { Series } from './charts';
import './reports.css';

type View = 'overview' | 'sprint' | 'monthly';

const CREATED_CLOSED: Series[] = [
  { key: 'created', label: 'Creados', slot: 1 },
  { key: 'closed', label: 'Cerrados', slot: 2 },
];
const TASKS_BUGS: Series[] = [
  { key: 'tasks', label: 'Tareas', slot: 1 },
  { key: 'bugs', label: 'Bugs', slot: 2 },
];
const PRIORITY_LABEL = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' } as const;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function Status({ pending, error, children }: { pending: boolean; error: unknown; children: ReactNode }) {
  if (error) {
    return <p className="qr-message">No pudimos cargar este reporte. {getApiErrorMessage(error)}</p>;
  }
  if (pending) {
    return <p className="qr-message">Cargando reporte…</p>;
  }
  return <>{children}</>;
}

function OverviewView({ report }: { report: OverviewReport }) {
  const tasks = report.summaryTable.find((row) => row.type === 'TASK');
  const bugs = report.summaryTable.find((row) => row.type === 'BUG');
  const totalOf = (row?: { open: number; inProgress: number; completed: number }) =>
    row ? row.open + row.inProgress + row.completed : 0;
  const points = report.trend.map((point) => ({
    label: weekLabel(point.weekStart, point.bucket),
    tooltipLabel: point.weekStart ? `Semana del ${shortDay(point.weekStart)}` : point.bucket,
    values: { created: point.created, closed: point.closed },
  }));

  return (
    <>
      <div className="qr-stats">
        <StatTile
          label="Tickets totales"
          value={report.kpis.totalTickets}
          note={[tasks ? plural(totalOf(tasks), 'tarea', 'tareas') : '', bugs ? plural(totalOf(bugs), 'bug', 'bugs') : '']
            .filter(Boolean)
            .join(' · ')}
        />
        <StatTile
          label="Completados"
          value={report.kpis.completedTickets}
          note={`${formatPercent(report.kpis.completionRate)} del total`}
        />
        <StatTile label="Bugs abiertos" value={report.kpis.openBugs} note="Abiertos o en progreso" />
        <StatTile
          label="Reabiertos · arrastrados"
          value={`${report.kpis.reopenedTickets} · ${report.kpis.rolloverTickets}`}
          note="Desde el inicio del proyecto"
        />
      </div>

      <div className="qr-grid">
        <ChartCard
          title="Creados y cerrados por semana"
          series={CREATED_CLOSED}
          table={{
            columns: ['Semana del', 'Creados', 'Cerrados'],
            rows: points.map((point) => [point.label, point.values.created, point.values.closed]),
          }}
        >
          <ColumnChart series={CREATED_CLOSED} points={points} ariaLabel="Tickets creados y cerrados en las últimas 8 semanas" />
        </ChartCard>

        <div className="qr-stack">
          <ChartCard title="Tickets por prioridad">
            <MeterList
              rows={report.priorityDistribution.map((item) => ({ label: PRIORITY_LABEL[item.priority], value: item.count }))}
            />
          </ChartCard>
          <ChartCard title="Estado por tipo">
            <table className="qr-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Tipo</span>
                  </th>
                  <th scope="col">Pendiente</th>
                  <th scope="col">En progreso</th>
                  <th scope="col">Completado</th>
                </tr>
              </thead>
              <tbody>
                {report.summaryTable.map((row) => (
                  <tr key={row.type}>
                    <th scope="row">{row.type === 'TASK' ? 'Tareas' : 'Bugs'}</th>
                    <td>{row.open}</td>
                    <td>{row.inProgress}</td>
                    <td>{row.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ChartCard>
        </div>
      </div>
    </>
  );
}

function SprintView({ report }: { report: SprintReport }) {
  const pending = Math.max(0, report.kpis.committedAtStart - report.kpis.completedInSprint);
  const isOpen = !report.sprint.closedAt;
  const burndown = report.burndown.map((point) => ({ label: shortDay(point.date), value: point.remaining }));
  const delivery = report.delivery.map((row) => ({
    label: weekLabel(row.weekStart, row.bucket),
    tooltipLabel: row.weekStart ? `Semana del ${shortDay(row.weekStart)}` : row.bucket,
    values: { tasks: row.completedTasks, bugs: row.completedBugs },
    rollover: row.rollover,
  }));

  return (
    <>
      <div className="qr-stats">
        <StatTile
          label="Comprometidos al inicio"
          value={report.kpis.committedAtStart}
          note={`${report.sprint.name} · desde el ${shortDay(report.sprint.startedAt)}`}
        />
        <StatTile
          label="Completados"
          value={report.kpis.completedInSprint}
          note={`${formatPercent(report.kpis.completionRate)} de lo comprometido`}
        />
        {isOpen ? (
          <StatTile label="Pendientes hoy" value={pending} note="Pasarían al siguiente sprint" />
        ) : (
          <StatTile label="Arrastrados" value={report.kpis.rolloverToNext} note="Pasaron al siguiente sprint" />
        )}
        <StatTile label="Reabiertos" value={report.kpis.reopenedInSprint} note="Durante este sprint" />
      </div>

      <div className="qr-grid">
        <ChartCard
          title="Burndown"
          table={{ columns: ['Día', 'Pendientes'], rows: burndown.map((point) => [point.label, point.value]) }}
          note={
            burndown.length < 2
              ? `El burndown se dibuja día a día mientras el sprint avanza. Hoy quedan ${plural(
                  burndown[burndown.length - 1]?.value ?? pending,
                  'ticket pendiente',
                  'tickets pendientes',
                )}.`
              : undefined
          }
        >
          <BurndownChart points={burndown} ariaLabel={`Tickets pendientes por día en ${report.sprint.name}`} />
        </ChartCard>

        <ChartCard
          title="Entregado por semana"
          series={TASKS_BUGS}
          table={{
            columns: ['Semana del', 'Tareas', 'Bugs', 'Arrastrados'],
            rows: delivery.map((row) => [row.label, row.values.tasks, row.values.bugs, row.rollover]),
          }}
        >
          {delivery.length > 0 ? (
            <ColumnChart series={TASKS_BUGS} points={delivery} ariaLabel="Tareas y bugs terminados por semana" />
          ) : (
            <p className="qr-message">Aún no se ha terminado ningún ticket en este sprint.</p>
          )}
        </ChartCard>
      </div>
    </>
  );
}

function MonthlyView({ report }: { report: MonthlyReport }) {
  const sliceLabel = (weekStart: string | undefined, fallback: string) => (weekStart ? monthSliceLabel(weekStart) : fallback);
  const trend = report.weeklyTrend.map((point) => ({
    label: sliceLabel(point.weekStart, point.week),
    tooltipLabel: sliceLabel(point.weekStart, point.week),
    values: { created: point.created, closed: point.closed },
  }));
  const byType = report.weeklyTypeClosure.map((point) => ({
    label: sliceLabel(point.weekStart, point.week),
    tooltipLabel: sliceLabel(point.weekStart, point.week),
    values: { tasks: point.tasksClosed, bugs: point.bugsClosed },
  }));

  return (
    <>
      <div className="qr-stats">
        <StatTile label="Creados" value={report.kpis.created} note="En el mes" />
        <StatTile label="Cerrados" value={report.kpis.closed} note="En el mes" />
        <StatTile label="Tiempo promedio de cierre" value={formatLeadTime(report.kpis.avgLeadTimeDays, report.kpis.closed)} note="Desde que se crea hasta que se cierra" />
        <StatTile label="Tasa de reapertura" value={formatPercent(report.kpis.reopenRate)} note="Reabiertos sobre cerrados" />
      </div>
      <div className="qr-grid qr-grid--even">
        <ChartCard
          title="Creados y cerrados por semana"
          series={CREATED_CLOSED}
          table={{ columns: ['Semana', 'Creados', 'Cerrados'], rows: trend.map((p) => [p.label, p.values.created, p.values.closed]) }}
        >
          <ColumnChart series={CREATED_CLOSED} points={trend} ariaLabel="Tickets creados y cerrados por semana del mes" />
        </ChartCard>
        <ChartCard
          title="Cerrados por tipo"
          series={TASKS_BUGS}
          table={{ columns: ['Semana', 'Tareas', 'Bugs'], rows: byType.map((p) => [p.label, p.values.tasks, p.values.bugs]) }}
        >
          <ColumnChart series={TASKS_BUGS} points={byType} ariaLabel="Tareas y bugs cerrados por semana del mes" />
        </ChartCard>
      </div>
    </>
  );
}

export function ReportsPanel({ accessToken, projectId }: { accessToken: string; projectId: string }) {
  const toast = useToast();
  const [view, setView] = useState<View>('overview');
  const [sprintId, setSprintId] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const contentRef = useRef<HTMLDivElement>(null);

  const sprintsQuery = useQuery({
    queryKey: ['reports-sprints', projectId],
    queryFn: () => listSprints(accessToken, projectId),
    retry: false,
  });
  const sprints = [...(sprintsQuery.data ?? [])].sort((a, b) => b.sequence - a.sequence);

  useEffect(() => {
    if (!sprintId && sprints.length > 0) {
      setSprintId(sprints[0].id);
    }
  }, [sprintId, sprints]);

  // placeholderData: al cambiar de sprint o de mes se mantiene el reporte anterior mientras carga.
  const overviewQuery = useQuery({
    queryKey: ['reports-overview', projectId, 8],
    queryFn: () => getOverviewReport(accessToken, projectId, 8),
    enabled: view === 'overview',
    retry: false,
  });
  const sprintQuery = useQuery({
    queryKey: ['reports-sprint', projectId, sprintId],
    queryFn: () => getSprintReport(accessToken, projectId, sprintId),
    enabled: view === 'sprint' && Boolean(sprintId),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const monthlyQuery = useQuery({
    queryKey: ['reports-monthly', projectId, month],
    queryFn: () => getMonthlyReport(accessToken, projectId, month),
    enabled: view === 'monthly' && /^\d{4}-\d{2}$/.test(month),
    placeholderData: (previous) => previous,
    retry: false,
  });

  const csvMutation = useMutation({
    mutationFn: () => {
      if (view === 'overview') {
        return downloadOverviewCsv(accessToken, projectId, 8);
      }
      if (view === 'sprint') {
        return downloadSprintCsv(accessToken, projectId, sprintId);
      }
      return downloadMonthlyCsv(accessToken, projectId, month);
    },
    onError: (error) => toast(getApiErrorMessage(error), 'error'),
  });

  const pdfMutation = useMutation({
    mutationFn: async () => {
      if (!contentRef.current) {
        throw new Error('No hay reporte para exportar.');
      }
      const name =
        view === 'overview' ? 'reporte-general' : view === 'sprint' ? `reporte-${sprints.find((s) => s.id === sprintId)?.name ?? 'sprint'}` : `reporte-${month}`;
      await exportElementToPdf(contentRef.current, `${name.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    },
    onError: () => toast('No pudimos generar el PDF. Intenta de nuevo.', 'error'),
  });

  const activeQuery = view === 'overview' ? overviewQuery : view === 'sprint' ? sprintQuery : monthlyQuery;
  const refreshing = activeQuery.isFetching && !activeQuery.isPending;

  return (
    <div className="qr">
      <div className="qr-filters">
        <div className="qx-segmented" role="group" aria-label="Tipo de reporte">
          {(
            [
              ['overview', 'General'],
              ['sprint', 'Sprint'],
              ['monthly', 'Mensual'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </div>

        {view === 'sprint' && sprints.length > 0 ? (
          <label className="qr-filter">
            <span className="sr-only">Sprint</span>
            <Select value={sprintId} onChange={(event) => setSprintId(event.target.value)}>
              {sprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} · {sprint.status === 'ACTIVE' ? 'en curso' : 'cerrado'}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        {view === 'monthly' ? (
          <label className="qr-filter">
            <span className="sr-only">Mes</span>
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        ) : null}

        <div className="qr-exports">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => csvMutation.mutate()}
            loading={csvMutation.isPending}
            disabled={view === 'sprint' && !sprintId}
          >
            Exportar CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => pdfMutation.mutate()} loading={pdfMutation.isPending}>
            Exportar PDF
          </Button>
        </div>
      </div>

      <div ref={contentRef} className={`qr-content${refreshing ? ' is-refreshing' : ''}`}>
        {view === 'overview' ? (
          <Status pending={overviewQuery.isPending} error={overviewQuery.error}>
            {overviewQuery.data ? <OverviewView report={overviewQuery.data} /> : null}
          </Status>
        ) : null}

        {view === 'sprint' ? (
          sprintsQuery.isSuccess && sprints.length === 0 ? (
            <p className="qr-message">Este proyecto todavía no tiene sprints. Inicia uno para ver su reporte.</p>
          ) : (
            <Status pending={sprintQuery.isPending} error={sprintQuery.error}>
              {sprintQuery.data ? <SprintView report={sprintQuery.data} /> : null}
            </Status>
          )
        ) : null}

        {view === 'monthly' ? (
          <Status pending={monthlyQuery.isPending} error={monthlyQuery.error}>
            {monthlyQuery.data ? <MonthlyView report={monthlyQuery.data} /> : null}
          </Status>
        ) : null}
      </div>
    </div>
  );
}
