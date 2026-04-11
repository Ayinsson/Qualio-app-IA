import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
