import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { WORK_ITEM_TYPES, type WorkItemType } from '../../planning/work-item-types';
import { BACKLOG_SECTIONS, type BacklogSection } from '../../tasks/dto/create-task.dto';
import { BUG_PRIORITIES, type BugPriority } from './create-bug.dto';

const BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
type BugStatus = (typeof BUG_STATUSES)[number];

export class UpdateBugDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsIn(BUG_PRIORITIES)
  priority?: BugPriority;

  @IsOptional()
  @IsIn(BUG_STATUSES)
  status?: BugStatus;

  @IsOptional()
  @IsIn(BACKLOG_SECTIONS)
  section?: BacklogSection;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  environment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  expectedResult?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  actualResult?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  startDate?: string | null;

  /** null = sacarlo del Planning ("sin planificar"). */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(36)
  stageGroupId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(WORK_ITEM_TYPES)
  parentType?: WorkItemType | null;

  /** null = deja de ser subtarea. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(36)
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}
