export type SprintReportKpiDto = {
  committedAtStart: number;
  completedInSprint: number;
  completionRate: number;
  rolloverToNext: number;
  reopenedInSprint: number;
};

export type SprintBurndownPointDto = {
  date: string;
  remaining: number;
};

export type SprintDeliveryPointDto = {
  bucket: string;
  /** Primer día de la semana (AAAA-MM-DD). `bucket` se mantiene por compatibilidad. */
  weekStart: string;
  completedTasks: number;
  completedBugs: number;
  rollover: number;
};

export type SprintReportDto = {
  sprint: {
    id: string;
    name: string;
    sequence: number;
    startedAt: Date;
    closedAt: Date | null;
  };
  kpis: SprintReportKpiDto;
  burndown: SprintBurndownPointDto[];
  delivery: SprintDeliveryPointDto[];
};
