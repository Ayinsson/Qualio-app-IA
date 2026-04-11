import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  type OverviewKpiDto,
  type OverviewPriorityPointDto,
  type OverviewReportDto,
  type OverviewSummaryRowDto,
  type OverviewTrendPointDto,
} from './dto/overview-report.dto';
import { type MonthlyReportDto } from './dto/monthly-report.dto';
import { type SprintReportDto } from './dto/sprint-report.dto';

type AggregatesRow = {
  totalTickets: number;
  completedTickets: number;
  openBugs: number;
  rolloverTickets: number;
};

type PriorityRow = {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  count: number;
};

type SummaryRow = {
  type: 'TASK' | 'BUG';
  open: number;
  inProgress: number;
  completed: number;
};

type TrendCreatedRow = {
  bucket: Date;
  created: number;
};

type TrendClosedRow = {
  bucket: Date;
  closed: number;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(ownerId: string, projectId: string, weeks = 8): Promise<OverviewReportDto> {
    await this.ensureProjectOwnership(projectId, ownerId);
    const normalizedWeeks = Number.isFinite(weeks) ? Math.min(Math.max(Math.trunc(weeks), 1), 26) : 8;

    const [aggregateRows, priorityRows, summaryRows, trendCreatedRows, trendClosedRows, reopenedRows] = await Promise.all([
      this.prisma.$queryRaw<AggregatesRow[]>`
        WITH items AS (
          SELECT
            'TASK'::VARCHAR AS item_type,
            t.priority,
            t.status,
            t.created_at,
            t.updated_at,
            (t.rollover_from_sprint_id IS NOT NULL) AS is_rollover
          FROM tasks t
          WHERE t.project_id = ${projectId}

          UNION ALL

          SELECT
            'BUG'::VARCHAR AS item_type,
            b.priority,
            b.status,
            b.created_at,
            b.updated_at,
            (b.rollover_from_sprint_id IS NOT NULL) AS is_rollover
          FROM bugs b
          WHERE b.project_id = ${projectId}
        )
        SELECT
          COUNT(*)::int AS "totalTickets",
          COUNT(*) FILTER (
            WHERE (item_type = 'TASK' AND status = 'DONE')
               OR (item_type = 'BUG' AND status IN ('RESOLVED', 'CLOSED'))
          )::int AS "completedTickets",
          COUNT(*) FILTER (
            WHERE item_type = 'BUG' AND status IN ('OPEN', 'IN_PROGRESS')
          )::int AS "openBugs",
          COUNT(*) FILTER (WHERE is_rollover = true)::int AS "rolloverTickets"
        FROM items
      `,
      this.prisma.$queryRaw<PriorityRow[]>`
        WITH items AS (
          SELECT priority
          FROM tasks
          WHERE project_id = ${projectId}

          UNION ALL

          SELECT priority
          FROM bugs
          WHERE project_id = ${projectId}
        )
        SELECT
          priority,
          COUNT(*)::int AS count
        FROM items
        GROUP BY priority
      `,
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          'TASK'::VARCHAR AS type,
          COUNT(*) FILTER (WHERE status = 'TODO')::int AS open,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS "inProgress",
          COUNT(*) FILTER (WHERE status = 'DONE')::int AS completed
        FROM tasks
        WHERE project_id = ${projectId}

        UNION ALL

        SELECT
          'BUG'::VARCHAR AS type,
          COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS "inProgress",
          COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED'))::int AS completed
        FROM bugs
        WHERE project_id = ${projectId}
      `,
      this.prisma.$queryRaw<TrendCreatedRow[]>`
        WITH created_items AS (
          SELECT created_at
          FROM tasks
          WHERE project_id = ${projectId}

          UNION ALL

          SELECT created_at
          FROM bugs
          WHERE project_id = ${projectId}
        )
        SELECT
          DATE_TRUNC('week', created_at)::date AS bucket,
          COUNT(*)::int AS created
        FROM created_items
        WHERE created_at >= DATE_TRUNC('week', NOW()) - (${normalizedWeeks - 1} * INTERVAL '1 week')
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY bucket ASC
      `,
      this.prisma.$queryRaw<TrendClosedRow[]>`
        WITH closed_items AS (
          SELECT updated_at
          FROM tasks
          WHERE project_id = ${projectId}
            AND status = 'DONE'

          UNION ALL

          SELECT updated_at
          FROM bugs
          WHERE project_id = ${projectId}
            AND status IN ('RESOLVED', 'CLOSED')
        )
        SELECT
          DATE_TRUNC('week', updated_at)::date AS bucket,
          COUNT(*)::int AS closed
        FROM closed_items
        WHERE updated_at >= DATE_TRUNC('week', NOW()) - (${normalizedWeeks - 1} * INTERVAL '1 week')
        GROUP BY DATE_TRUNC('week', updated_at)
        ORDER BY bucket ASC
      `,
      this.prisma.$queryRaw<Array<{ reopenedTickets: number }>>`
        SELECT
          COUNT(*)::int AS "reopenedTickets"
        FROM work_item_history h
        WHERE h.project_id = ${projectId}
          AND h.field_name = 'status'
          AND (
            (h.entity_type = 'TASK' AND h.old_value = 'DONE' AND h.new_value IN ('TODO', 'IN_PROGRESS'))
            OR
            (h.entity_type = 'BUG' AND h.old_value IN ('RESOLVED', 'CLOSED') AND h.new_value IN ('OPEN', 'IN_PROGRESS'))
          )
      `,
    ]);

    const aggregates = aggregateRows[0] ?? {
      totalTickets: 0,
      completedTickets: 0,
      openBugs: 0,
      rolloverTickets: 0,
    };

    const reopenedTickets = reopenedRows[0]?.reopenedTickets ?? 0;

    const completionRate =
      aggregates.totalTickets > 0
        ? Number(((aggregates.completedTickets / aggregates.totalTickets) * 100).toFixed(1))
        : 0;

    const kpis: OverviewKpiDto = {
      totalTickets: aggregates.totalTickets,
      completedTickets: aggregates.completedTickets,
      completionRate,
      openBugs: aggregates.openBugs,
      reopenedTickets,
      rolloverTickets: aggregates.rolloverTickets,
    };

    const priorityMap = new Map(priorityRows.map((row) => [row.priority, row.count]));
    const priorityDistribution: OverviewPriorityPointDto[] = [
      { priority: 'HIGH', count: priorityMap.get('HIGH') ?? 0 },
      { priority: 'MEDIUM', count: priorityMap.get('MEDIUM') ?? 0 },
      { priority: 'LOW', count: priorityMap.get('LOW') ?? 0 },
    ];

    const baseSummaryRows: OverviewSummaryRowDto[] = [
      { type: 'TASK', open: 0, inProgress: 0, completed: 0 },
      { type: 'BUG', open: 0, inProgress: 0, completed: 0 },
    ];

    const summaryTable: OverviewSummaryRowDto[] = baseSummaryRows.map((baseRow) => {
      const found = summaryRows.find((row) => row.type === baseRow.type);
      return {
        type: baseRow.type,
        open: found?.open ?? 0,
        inProgress: found?.inProgress ?? 0,
        completed: found?.completed ?? 0,
      };
    });

    const createdMap = new Map(trendCreatedRows.map((row) => [this.toBucketLabel(row.bucket), row.created]));
    const closedMap = new Map(trendClosedRows.map((row) => [this.toBucketLabel(row.bucket), row.closed]));
    const trend: OverviewTrendPointDto[] = this.buildWeeklyBuckets(normalizedWeeks).map((bucket) => ({
      bucket,
      created: createdMap.get(bucket) ?? 0,
      closed: closedMap.get(bucket) ?? 0,
    }));

    return {
      kpis,
      trend,
      priorityDistribution,
      summaryTable,
    };
  }

  async getSprintReport(ownerId: string, projectId: string, sprintId: string): Promise<SprintReportDto> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const sprintRows = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; sequence: number; startedAt: Date; closedAt: Date | null }>
    >`
      SELECT
        id,
        name,
        sequence,
        started_at AS "startedAt",
        closed_at AS "closedAt"
      FROM sprints
      WHERE id = ${sprintId}
        AND project_id = ${projectId}
      LIMIT 1
    `;

    const sprint = sprintRows[0];
    if (!sprint) {
      throw new NotFoundException('Sprint no encontrado para este proyecto.');
    }

    const [kpiRows, reopenedRows, burndownRows, deliveryRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          committedAtStart: number;
          completedInSprint: number;
          rolloverToNext: number;
        }>
      >`
        WITH task_items AS (
          SELECT
            id,
            (sprint_id = ${sprintId} OR completed_in_sprint_id = ${sprintId} OR rollover_from_sprint_id = ${sprintId}) AS is_committed,
            (completed_in_sprint_id = ${sprintId}) AS is_completed,
            (rollover_from_sprint_id = ${sprintId}) AS is_rollover
          FROM tasks
          WHERE project_id = ${projectId}
        ),
        bug_items AS (
          SELECT
            id,
            (sprint_id = ${sprintId} OR completed_in_sprint_id = ${sprintId} OR rollover_from_sprint_id = ${sprintId}) AS is_committed,
            (completed_in_sprint_id = ${sprintId}) AS is_completed,
            (rollover_from_sprint_id = ${sprintId}) AS is_rollover
          FROM bugs
          WHERE project_id = ${projectId}
        ),
        all_items AS (
          SELECT is_committed, is_completed, is_rollover FROM task_items
          UNION ALL
          SELECT is_committed, is_completed, is_rollover FROM bug_items
        )
        SELECT
          COUNT(*) FILTER (WHERE is_committed)::int AS "committedAtStart",
          COUNT(*) FILTER (WHERE is_completed)::int AS "completedInSprint",
          COUNT(*) FILTER (WHERE is_rollover)::int AS "rolloverToNext"
        FROM all_items
      `,
      this.prisma.$queryRaw<Array<{ reopenedInSprint: number }>>`
        SELECT
          COUNT(*)::int AS "reopenedInSprint"
        FROM work_item_history h
        WHERE h.project_id = ${projectId}
          AND h.field_name = 'status'
          AND h.created_at >= ${sprint.startedAt}
          AND h.created_at < ${sprint.closedAt ?? new Date()}
          AND (
            (h.entity_type = 'TASK' AND h.old_value = 'DONE' AND h.new_value IN ('TODO', 'IN_PROGRESS'))
            OR
            (h.entity_type = 'BUG' AND h.old_value IN ('RESOLVED', 'CLOSED') AND h.new_value IN ('OPEN', 'IN_PROGRESS'))
          )
      `,
      this.prisma.$queryRaw<Array<{ date: Date; remaining: number }>>`
        WITH params AS (
          SELECT
            ${sprint.startedAt}::timestamp AS start_date,
            ${sprint.closedAt ?? new Date()}::timestamp AS end_date
        ),
        days AS (
          SELECT generate_series(
            date_trunc('day', (SELECT start_date FROM params)),
            date_trunc('day', (SELECT end_date FROM params)),
            interval '1 day'
          ) AS day
        ),
        committed AS (
          SELECT (
            COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = ${projectId} AND (sprint_id = ${sprintId} OR completed_in_sprint_id = ${sprintId} OR rollover_from_sprint_id = ${sprintId})), 0) +
            COALESCE((SELECT COUNT(*) FROM bugs WHERE project_id = ${projectId} AND (sprint_id = ${sprintId} OR completed_in_sprint_id = ${sprintId} OR rollover_from_sprint_id = ${sprintId})), 0)
          )::int AS total
        ),
        closed_by_day AS (
          SELECT
            date_trunc('day', closed_at) AS day,
            COUNT(*)::int AS closed
          FROM (
            SELECT updated_at AS closed_at
            FROM tasks
            WHERE project_id = ${projectId}
              AND completed_in_sprint_id = ${sprintId}
            UNION ALL
            SELECT updated_at AS closed_at
            FROM bugs
            WHERE project_id = ${projectId}
              AND completed_in_sprint_id = ${sprintId}
          ) i
          GROUP BY date_trunc('day', closed_at)
        )
        SELECT
          d.day::date AS date,
          GREATEST(
            (SELECT total FROM committed) -
            COALESCE((
              SELECT SUM(c.closed)::int
              FROM closed_by_day c
              WHERE c.day <= d.day
            ), 0),
            0
          ) AS remaining
        FROM days d
        ORDER BY d.day ASC
      `,
      this.prisma.$queryRaw<Array<{ bucket: Date; completedTasks: number; completedBugs: number; rollover: number }>>`
        WITH bounds AS (
          SELECT
            ${sprint.startedAt}::timestamp AS start_date,
            ${sprint.closedAt ?? new Date()}::timestamp AS end_date
        ),
        task_closed AS (
          SELECT date_trunc('week', updated_at)::date AS bucket, COUNT(*)::int AS count
          FROM tasks
          WHERE project_id = ${projectId}
            AND completed_in_sprint_id = ${sprintId}
            AND updated_at >= (SELECT start_date FROM bounds)
            AND updated_at < (SELECT end_date FROM bounds)
          GROUP BY date_trunc('week', updated_at)
        ),
        bug_closed AS (
          SELECT date_trunc('week', updated_at)::date AS bucket, COUNT(*)::int AS count
          FROM bugs
          WHERE project_id = ${projectId}
            AND completed_in_sprint_id = ${sprintId}
            AND updated_at >= (SELECT start_date FROM bounds)
            AND updated_at < (SELECT end_date FROM bounds)
          GROUP BY date_trunc('week', updated_at)
        ),
        rolled AS (
          SELECT date_trunc('week', updated_at)::date AS bucket, COUNT(*)::int AS count
          FROM (
            SELECT updated_at
            FROM tasks
            WHERE project_id = ${projectId}
              AND rollover_from_sprint_id = ${sprintId}
              AND updated_at >= (SELECT start_date FROM bounds)
              AND updated_at < (SELECT end_date FROM bounds)
            UNION ALL
            SELECT updated_at
            FROM bugs
            WHERE project_id = ${projectId}
              AND rollover_from_sprint_id = ${sprintId}
              AND updated_at >= (SELECT start_date FROM bounds)
              AND updated_at < (SELECT end_date FROM bounds)
          ) x
          GROUP BY date_trunc('week', updated_at)
        ),
        all_weeks AS (
          SELECT bucket FROM task_closed
          UNION
          SELECT bucket FROM bug_closed
          UNION
          SELECT bucket FROM rolled
        )
        SELECT
          w.bucket,
          COALESCE(t.count, 0)::int AS "completedTasks",
          COALESCE(b.count, 0)::int AS "completedBugs",
          COALESCE(r.count, 0)::int AS rollover
        FROM all_weeks w
        LEFT JOIN task_closed t ON t.bucket = w.bucket
        LEFT JOIN bug_closed b ON b.bucket = w.bucket
        LEFT JOIN rolled r ON r.bucket = w.bucket
        ORDER BY w.bucket ASC
      `,
    ]);

    const kpi = kpiRows[0] ?? { committedAtStart: 0, completedInSprint: 0, rolloverToNext: 0 };
    const reopenedInSprint = reopenedRows[0]?.reopenedInSprint ?? 0;
    const completionRate =
      kpi.committedAtStart > 0 ? Number(((kpi.completedInSprint / kpi.committedAtStart) * 100).toFixed(1)) : 0;

    return {
      sprint,
      kpis: {
        committedAtStart: kpi.committedAtStart,
        completedInSprint: kpi.completedInSprint,
        completionRate,
        rolloverToNext: kpi.rolloverToNext,
        reopenedInSprint,
      },
      burndown: burndownRows.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        remaining: row.remaining,
      })),
      delivery: deliveryRows.map((row) => ({
        bucket: this.toBucketLabel(row.bucket),
        completedTasks: row.completedTasks,
        completedBugs: row.completedBugs,
        rollover: row.rollover,
      })),
    };
  }

  async getMonthlyReport(ownerId: string, projectId: string, month: string): Promise<MonthlyReportDto> {
    await this.ensureProjectOwnership(projectId, ownerId);
    const { start, end } = this.parseMonthRange(month);

    const [kpiRows, reopenedRows, weeklyCreatedRows, weeklyClosedRows, weeklyTypeRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ created: number; closed: number; avgLeadTimeDays: number | null }>>`
        WITH created_items AS (
          SELECT created_at
          FROM tasks
          WHERE project_id = ${projectId}
            AND created_at >= ${start}
            AND created_at < ${end}
          UNION ALL
          SELECT created_at
          FROM bugs
          WHERE project_id = ${projectId}
            AND created_at >= ${start}
            AND created_at < ${end}
        ),
        closed_items AS (
          SELECT created_at, updated_at
          FROM tasks
          WHERE project_id = ${projectId}
            AND status = 'DONE'
            AND updated_at >= ${start}
            AND updated_at < ${end}
          UNION ALL
          SELECT created_at, updated_at
          FROM bugs
          WHERE project_id = ${projectId}
            AND status IN ('RESOLVED', 'CLOSED')
            AND updated_at >= ${start}
            AND updated_at < ${end}
        )
        SELECT
          (SELECT COUNT(*)::int FROM created_items) AS created,
          (SELECT COUNT(*)::int FROM closed_items) AS closed,
          (SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400.0) FROM closed_items) AS "avgLeadTimeDays"
      `,
      this.prisma.$queryRaw<Array<{ reopened: number }>>`
        SELECT
          COUNT(*)::int AS reopened
        FROM work_item_history h
        WHERE h.project_id = ${projectId}
          AND h.field_name = 'status'
          AND h.created_at >= ${start}
          AND h.created_at < ${end}
          AND (
            (h.entity_type = 'TASK' AND h.old_value = 'DONE' AND h.new_value IN ('TODO', 'IN_PROGRESS'))
            OR
            (h.entity_type = 'BUG' AND h.old_value IN ('RESOLVED', 'CLOSED') AND h.new_value IN ('OPEN', 'IN_PROGRESS'))
          )
      `,
      this.prisma.$queryRaw<Array<{ week: number; created: number }>>`
        WITH items AS (
          SELECT created_at
          FROM tasks
          WHERE project_id = ${projectId}
            AND created_at >= ${start}
            AND created_at < ${end}
          UNION ALL
          SELECT created_at
          FROM bugs
          WHERE project_id = ${projectId}
            AND created_at >= ${start}
            AND created_at < ${end}
        )
        SELECT
          (EXTRACT(DAY FROM created_at)::int - 1) / 7 + 1 AS week,
          COUNT(*)::int AS created
        FROM items
        GROUP BY week
        ORDER BY week ASC
      `,
      this.prisma.$queryRaw<Array<{ week: number; closed: number }>>`
        WITH items AS (
          SELECT updated_at AS closed_at
          FROM tasks
          WHERE project_id = ${projectId}
            AND status = 'DONE'
            AND updated_at >= ${start}
            AND updated_at < ${end}
          UNION ALL
          SELECT updated_at AS closed_at
          FROM bugs
          WHERE project_id = ${projectId}
            AND status IN ('RESOLVED', 'CLOSED')
            AND updated_at >= ${start}
            AND updated_at < ${end}
        )
        SELECT
          (EXTRACT(DAY FROM closed_at)::int - 1) / 7 + 1 AS week,
          COUNT(*)::int AS closed
        FROM items
        GROUP BY week
        ORDER BY week ASC
      `,
      this.prisma.$queryRaw<Array<{ week: number; tasksClosed: number; bugsClosed: number }>>`
        WITH task_closed AS (
          SELECT
            (EXTRACT(DAY FROM updated_at)::int - 1) / 7 + 1 AS week,
            COUNT(*)::int AS count
          FROM tasks
          WHERE project_id = ${projectId}
            AND status = 'DONE'
            AND updated_at >= ${start}
            AND updated_at < ${end}
          GROUP BY week
        ),
        bug_closed AS (
          SELECT
            (EXTRACT(DAY FROM updated_at)::int - 1) / 7 + 1 AS week,
            COUNT(*)::int AS count
          FROM bugs
          WHERE project_id = ${projectId}
            AND status IN ('RESOLVED', 'CLOSED')
            AND updated_at >= ${start}
            AND updated_at < ${end}
          GROUP BY week
        ),
        weeks AS (
          SELECT week FROM task_closed
          UNION
          SELECT week FROM bug_closed
        )
        SELECT
          w.week,
          COALESCE(t.count, 0)::int AS "tasksClosed",
          COALESCE(b.count, 0)::int AS "bugsClosed"
        FROM weeks w
        LEFT JOIN task_closed t ON t.week = w.week
        LEFT JOIN bug_closed b ON b.week = w.week
        ORDER BY w.week ASC
      `,
    ]);

    const kpi = kpiRows[0] ?? { created: 0, closed: 0, avgLeadTimeDays: 0 };
    const reopened = reopenedRows[0]?.reopened ?? 0;
    const reopenRate = kpi.closed > 0 ? Number(((reopened / kpi.closed) * 100).toFixed(1)) : 0;

    const createdMap = new Map(weeklyCreatedRows.map((row) => [row.week, row.created]));
    const closedMap = new Map(weeklyClosedRows.map((row) => [row.week, row.closed]));
    const maxWeek = Math.max(1, ...[...createdMap.keys(), ...closedMap.keys()]);

    const weeklyTrend = Array.from({ length: maxWeek }, (_, index) => {
      const week = index + 1;
      return {
        week: `W${week}`,
        created: createdMap.get(week) ?? 0,
        closed: closedMap.get(week) ?? 0,
      };
    });

    const typeMap = new Map(weeklyTypeRows.map((row) => [row.week, row]));
    const weeklyTypeClosure = Array.from({ length: maxWeek }, (_, index) => {
      const week = index + 1;
      const row = typeMap.get(week);
      return {
        week: `W${week}`,
        tasksClosed: row?.tasksClosed ?? 0,
        bugsClosed: row?.bugsClosed ?? 0,
      };
    });

    return {
      month,
      kpis: {
        created: kpi.created,
        closed: kpi.closed,
        avgLeadTimeDays: Number((kpi.avgLeadTimeDays ?? 0).toFixed(1)),
        reopenRate,
      },
      weeklyTrend,
      weeklyTypeClosure,
    };
  }

  async getOverviewCsv(ownerId: string, projectId: string, weeks = 8): Promise<string> {
    const report = await this.getOverview(ownerId, projectId, weeks);
    const lines: string[] = [];

    lines.push('section,key,value');
    lines.push(`kpi,totalTickets,${report.kpis.totalTickets}`);
    lines.push(`kpi,completedTickets,${report.kpis.completedTickets}`);
    lines.push(`kpi,completionRate,${report.kpis.completionRate}`);
    lines.push(`kpi,openBugs,${report.kpis.openBugs}`);
    lines.push(`kpi,reopenedTickets,${report.kpis.reopenedTickets}`);
    lines.push(`kpi,rolloverTickets,${report.kpis.rolloverTickets}`);

    lines.push('');
    lines.push('trend,bucket,created,closed');
    report.trend.forEach((row) => {
      lines.push(`trend,${this.csvCell(row.bucket)},${row.created},${row.closed}`);
    });

    lines.push('');
    lines.push('priority,priority,count');
    report.priorityDistribution.forEach((row) => {
      lines.push(`priority,${row.priority},${row.count}`);
    });

    lines.push('');
    lines.push('summary,type,open,inProgress,completed');
    report.summaryTable.forEach((row) => {
      lines.push(`summary,${row.type},${row.open},${row.inProgress},${row.completed}`);
    });

    return lines.join('\n');
  }

  async getSprintCsv(ownerId: string, projectId: string, sprintId: string): Promise<string> {
    const report = await this.getSprintReport(ownerId, projectId, sprintId);
    const lines: string[] = [];

    lines.push('section,key,value');
    lines.push(`sprint,name,${this.csvCell(report.sprint.name)}`);
    lines.push(`sprint,sequence,${report.sprint.sequence}`);
    lines.push(`kpi,committedAtStart,${report.kpis.committedAtStart}`);
    lines.push(`kpi,completedInSprint,${report.kpis.completedInSprint}`);
    lines.push(`kpi,completionRate,${report.kpis.completionRate}`);
    lines.push(`kpi,rolloverToNext,${report.kpis.rolloverToNext}`);
    lines.push(`kpi,reopenedInSprint,${report.kpis.reopenedInSprint}`);

    lines.push('');
    lines.push('burndown,date,remaining');
    report.burndown.forEach((row) => {
      lines.push(`burndown,${row.date},${row.remaining}`);
    });

    lines.push('');
    lines.push('delivery,bucket,completedTasks,completedBugs,rollover');
    report.delivery.forEach((row) => {
      lines.push(`delivery,${this.csvCell(row.bucket)},${row.completedTasks},${row.completedBugs},${row.rollover}`);
    });

    return lines.join('\n');
  }

  async getMonthlyCsv(ownerId: string, projectId: string, month: string): Promise<string> {
    const report = await this.getMonthlyReport(ownerId, projectId, month);
    const lines: string[] = [];

    lines.push('section,key,value');
    lines.push(`month,label,${report.month}`);
    lines.push(`kpi,created,${report.kpis.created}`);
    lines.push(`kpi,closed,${report.kpis.closed}`);
    lines.push(`kpi,avgLeadTimeDays,${report.kpis.avgLeadTimeDays}`);
    lines.push(`kpi,reopenRate,${report.kpis.reopenRate}`);

    lines.push('');
    lines.push('weeklyTrend,week,created,closed');
    report.weeklyTrend.forEach((row) => {
      lines.push(`weeklyTrend,${row.week},${row.created},${row.closed}`);
    });

    lines.push('');
    lines.push('weeklyTypeClosure,week,tasksClosed,bugsClosed');
    report.weeklyTypeClosure.forEach((row) => {
      lines.push(`weeklyTypeClosure,${row.week},${row.tasksClosed},${row.bugsClosed}`);
    });

    return lines.join('\n');
  }

  private buildWeeklyBuckets(weeks: number): string[] {
    const buckets: string[] = [];
    const now = new Date();
    const start = new Date(now);
    const day = start.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - diffToMonday);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7);

    for (let i = 0; i < weeks; i += 1) {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + i * 7);
      buckets.push(this.toBucketLabel(current));
    }

    return buckets;
  }

  private toBucketLabel(date: Date): string {
    const year = date.getUTCFullYear();
    const firstDay = new Date(Date.UTC(year, 0, 1));
    const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
    const week = Math.floor((days + firstDay.getUTCDay() + 6) / 7) + 1;
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  private parseMonthRange(month: string): { start: Date; end: Date } {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Formato de mes invalido. Usa YYYY-MM.');
    }

    const [yearPart, monthPart] = month.split('-');
    const year = Number(yearPart);
    const monthIndex = Number(monthPart) - 1;

    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      throw new BadRequestException('Mes invalido.');
    }

    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));

    return { start, end };
  }

  private csvCell(value: string): string {
    const safe = value.replace(/"/g, '""');
    return `"${safe}"`;
  }

  private async ensureProjectOwnership(projectId: string, ownerId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM projects
      WHERE id = ${projectId}
        AND owner_id = ${ownerId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new ForbiddenException('No tienes permiso para este proyecto.');
    }
  }
}
