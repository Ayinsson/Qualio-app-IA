export type OverviewKpiDto = {
  totalTickets: number;
  completedTickets: number;
  completionRate: number;
  openBugs: number;
  reopenedTickets: number;
  rolloverTickets: number;
};

export type OverviewTrendPointDto = {
  bucket: string;
  created: number;
  closed: number;
};

export type OverviewPriorityPointDto = {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  count: number;
};

export type OverviewSummaryRowDto = {
  type: 'TASK' | 'BUG';
  open: number;
  inProgress: number;
  completed: number;
};

export type OverviewReportDto = {
  kpis: OverviewKpiDto;
  trend: OverviewTrendPointDto[];
  priorityDistribution: OverviewPriorityPointDto[];
  summaryTable: OverviewSummaryRowDto[];
};
