import { IsIn, IsInt, Min } from 'class-validator';

import { BACKLOG_SECTIONS, type BacklogSection } from '../../tasks/dto/create-task.dto';

export class MoveBugDto {
  @IsIn(BACKLOG_SECTIONS)
  section!: BacklogSection;

  @IsInt()
  @Min(0)
  targetPosition!: number;
}
