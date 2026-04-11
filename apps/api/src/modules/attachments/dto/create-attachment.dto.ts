import { IsIn, IsInt, IsString, MaxLength, Min } from 'class-validator';

export const ATTACHMENT_ENTITY_TYPES = ['TASK', 'BUG'] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

export class CreateAttachmentDto {
  @IsIn(ATTACHMENT_ENTITY_TYPES)
  entityType!: AttachmentEntityType;

  @IsString()
  @MaxLength(36)
  entityId!: string;

  @IsString()
  @MaxLength(2000)
  storagePath!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  fileSize!: number;
}
