export type MonthlyReportKpiDto = {
  created: number;
  closed: number;
  avgLeadTimeDays: number;
  reopenRate: number;
};

export type MonthlyWeeklyTrendPointDto = {
  week: string;
  /** Primer día del tramo del mes (días 1-7, 8-14, ...), AAAA-MM-DD. */
  weekStart: string;
  created: number;
  closed: number;
};

export type MonthlyWeeklyTypeClosurePointDto = {
  week: string;
  /** Primer día del tramo del mes (días 1-7, 8-14, ...), AAAA-MM-DD. */
  weekStart: string;
  tasksClosed: number;
  bugsClosed: number;
};

export type MonthlyReportDto = {
  month: string;
  kpis: MonthlyReportKpiDto;
  weeklyTrend: MonthlyWeeklyTrendPointDto[];
  weeklyTypeClosure: MonthlyWeeklyTypeClosurePointDto[];
};
