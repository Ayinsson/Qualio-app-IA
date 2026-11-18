import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const TICKET_STATUS_FILTERS = ['open', 'closed', 'all'] as const;
export const TICKET_TYPE_FILTERS = ['task', 'bug'] as const;
export const TICKET_PRIORITY_FILTERS = ['HIGH', 'MEDIUM', 'LOW'] as const;
const BOOLEAN_FLAGS = ['true', 'false'] as const;

export class ListTicketsQueryDto {
  /** open (por defecto): tareas TODO/IN_PROGRESS y bugs OPEN/IN_PROGRESS. */
  @IsOptional()
  @IsIn(TICKET_STATUS_FILTERS)
  status?: (typeof TICKET_STATUS_FILTERS)[number];

  @IsOptional()
  @IsIn(TICKET_TYPE_FILTERS)
  type?: (typeof TICKET_TYPE_FILTERS)[number];

  /** Solo tickets abiertos con fecha límite anterior a hoy. */
  @IsOptional()
  @IsIn(BOOLEAN_FLAGS)
  overdue?: (typeof BOOLEAN_FLAGS)[number];

  /** Solo tareas asignadas a ti (los bugs no tienen responsable). */
  @IsOptional()
  @IsIn(BOOLEAN_FLAGS)
  assignedToMe?: (typeof BOOLEAN_FLAGS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(36)
  projectId?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITY_FILTERS)
  priority?: (typeof TICKET_PRIORITY_FILTERS)[number];

  /** Busca en el título y en la clave (por ejemplo "QA-12"). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
