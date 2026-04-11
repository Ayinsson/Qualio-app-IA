import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const PROJECT_TYPES = ['Tienda B2B O B2C', 'App movil', 'App web', 'Otro'] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export class CreateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsIn(PROJECT_TYPES)
  projectType!: ProjectType;
}
