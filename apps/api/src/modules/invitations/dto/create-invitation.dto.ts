import { IsEmail, IsIn, IsOptional } from 'class-validator';

const INVITATION_ROLES = ['ADMIN', 'MEMBER'] as const;
export type InvitationRole = (typeof INVITATION_ROLES)[number];

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(INVITATION_ROLES)
  role?: InvitationRole;
}
