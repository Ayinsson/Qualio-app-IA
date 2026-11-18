import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { WORK_ITEM_TYPES, type WorkItemType } from '../../planning/work-item-types';
import { BACKLOG_SECTIONS, type BacklogSection } from '../../tasks/dto/create-task.dto';

export const BUG_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;

export type BugPriority = (typeof BUG_PRIORITIES)[number];

export class CreateBugDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsIn(BUG_PRIORITIES)
  priority?: BugPriority;

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
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Macroactividad del Planning. No se combina con parentId: la subtarea hereda la del padre. */
  @IsOptional()
  @IsString()
  @MaxLength(36)
  stageGroupId?: string;

  @IsOptional()
  @IsIn(WORK_ITEM_TYPES)
  parentType?: WorkItemType;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  parentId?: string;
}
