import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Usa el formato AAAA-MM-DD.';
export const MOVE_DIRECTIONS = ['up', 'down'] as const;
export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

export class CreateStageDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  startDate!: string;

  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  endDate!: string;

  /** Entregables de la etapa (texto libre, uno por línea). */
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  deliverables?: string;

  /** Criterio "Cierra con". */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  exitCriteria?: string;
}

export class UpdateStageDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(20)
  code?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  ownerName?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  endDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  deliverables?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  exitCriteria?: string | null;

  /** Subir o bajar una posición. */
  @IsOptional()
  @IsIn(MOVE_DIRECTIONS)
  move?: MoveDirection;
}

export class CreateStageGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string;

  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  startDate!: string;

  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  endDate!: string;
}

export class UpdateStageGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  ownerName?: string | null;

  @IsOptional()
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  endDate?: string;

  @IsOptional()
  @IsIn(MOVE_DIRECTIONS)
  move?: MoveDirection;
}
