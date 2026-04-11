export type MonthlyReportKpiDto = {
  created: number;
  closed: number;
  avgLeadTimeDays: number;
  reopenRate: number;
};

export type MonthlyWeeklyTrendPointDto = {
  week: string;
  created: number;
  closed: number;
};

export type MonthlyWeeklyTypeClosurePointDto = {
  week: string;
  tasksClosed: number;
  bugsClosed: number;
};

export type MonthlyReportDto = {
  month: string;
  kpis: MonthlyReportKpiDto;
  weeklyTrend: MonthlyWeeklyTrendPointDto[];
  weeklyTypeClosure: MonthlyWeeklyTypeClosurePointDto[];
};
