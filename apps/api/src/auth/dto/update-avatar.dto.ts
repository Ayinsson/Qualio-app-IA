import { IsString, MinLength } from 'class-validator';

export class UpdateAvatarDto {
  @IsString()
  @MinLength(8)
  avatarUrl!: string;
}
