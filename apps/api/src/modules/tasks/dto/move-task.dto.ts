import { IsIn, IsInt, Min } from 'class-validator';

import { BACKLOG_SECTIONS, type BacklogSection } from './create-task.dto';

export class MoveTaskDto {
  @IsIn(BACKLOG_SECTIONS)
  section!: BacklogSection;

  @IsInt()
  @Min(0)
  targetPosition!: number;
}
