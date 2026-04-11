import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const TASK_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export const BACKLOG_SECTIONS = ['NEXT_SPRINT', 'GENERAL_BACKLOG', 'SPRINT_BOARD'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type BacklogSection = (typeof BACKLOG_SECTIONS)[number];

export class CreateTaskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsIn(BACKLOG_SECTIONS)
  section?: BacklogSection;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  sprintId?: string;
}
