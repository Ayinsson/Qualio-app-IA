export class ProjectSummaryDto {
  projectId!: string;
  totalTasks!: number;
  completedTasks!: number;
  totalTestCases!: number;
  totalBugs!: number;
  openBugs!: number;
}
