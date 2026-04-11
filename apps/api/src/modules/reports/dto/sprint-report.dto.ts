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
