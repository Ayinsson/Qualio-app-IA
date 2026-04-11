import { api } from './api';

export type OverviewReport = {
  kpis: {
    totalTickets: number;
    completedTickets: number;
    completionRate: number;
    openBugs: number;
    reopenedTickets: number;
    rolloverTickets: number;
  };
  trend: Array<{
    bucket: string;
    created: number;
    closed: number;
  }>;
  priorityDistribution: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    count: number;
  }>;
  summaryTable: Array<{
    type: 'TASK' | 'BUG';
    open: number;
    inProgress: number;
    completed: number;
  }>;
};

export type SprintReport = {
  sprint: {
    id: string;
    name: string;
    sequence: number;
    startedAt: string;
    closedAt: string | null;
  };
  kpis: {
    committedAtStart: number;
    completedInSprint: number;
    completionRate: number;
    rolloverToNext: number;
    reopenedInSprint: number;
  };
  burndown: Array<{
    date: string;
    remaining: number;
  }>;
  delivery: Array<{
    bucket: string;
    completedTasks: number;
    completedBugs: number;
    rollover: number;
  }>;
};

export type MonthlyReport = {
  month: string;
  kpis: {
    created: number;
    closed: number;
    avgLeadTimeDays: number;
    reopenRate: number;
  };
  weeklyTrend: Array<{
    week: string;
    created: number;
    closed: number;
  }>;
  weeklyTypeClosure: Array<{
    week: string;
    tasksClosed: number;
    bugsClosed: number;
  }>;
};

function authHeader(accessToken: string) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export async function getOverviewReport(accessToken: string, projectId: string, weeks = 8): Promise<OverviewReport> {
  const { data } = await api.get<OverviewReport>(`/projects/${projectId}/reports/overview`, {
    ...authHeader(accessToken),
    params: { weeks },
  });
  return data;
}

export async function getSprintReport(accessToken: string, projectId: string, sprintId: string): Promise<SprintReport> {
  const { data } = await api.get<SprintReport>(`/projects/${projectId}/reports/sprints/${sprintId}`, authHeader(accessToken));
  return data;
}

export async function getMonthlyReport(accessToken: string, projectId: string, month: string): Promise<MonthlyReport> {
  const { data } = await api.get<MonthlyReport>(`/projects/${projectId}/reports/monthly`, {
    ...authHeader(accessToken),
    params: { month },
  });
  return data;
}

async function downloadCsv(url: string, accessToken: string, fileName: string, params?: Record<string, string | number>) {
  const response = await api.get<Blob>(url, {
    ...authHeader(accessToken),
    params,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(href);
}

export async function downloadOverviewCsv(accessToken: string, projectId: string, weeks = 8): Promise<void> {
  return downloadCsv(`/projects/${projectId}/reports/overview.csv`, accessToken, `overview-${projectId}.csv`, { weeks });
}

export async function downloadSprintCsv(accessToken: string, projectId: string, sprintId: string): Promise<void> {
  return downloadCsv(`/projects/${projectId}/reports/sprints/${sprintId}.csv`, accessToken, `sprint-${sprintId}.csv`);
}

export async function downloadMonthlyCsv(accessToken: string, projectId: string, month: string): Promise<void> {
  return downloadCsv(`/projects/${projectId}/reports/monthly.csv`, accessToken, `monthly-${month}.csv`, { month });
}
