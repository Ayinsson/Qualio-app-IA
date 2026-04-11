import { IsEmail, IsIn, IsOptional } from 'class-validator';

export const PROJECT_MEMBER_ROLES = ['ADMIN', 'MEMBER'] as const;
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

export class AddProjectMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(PROJECT_MEMBER_ROLES)
  role?: ProjectMemberRole;
}
