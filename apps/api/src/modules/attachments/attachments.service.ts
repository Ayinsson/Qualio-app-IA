import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { type AttachmentEntityType, CreateAttachmentDto } from './dto/create-attachment.dto';

export type AttachmentEntity = {
  id: string;
  entityType: 'TASK' | 'BUG';
  entityId: string;
  projectId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: Date;
};

type AttachmentRow = Omit<AttachmentEntity, 'fileSize'> & {
  fileSize: bigint | number;
};

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAttachmentDto): Promise<AttachmentEntity> {
    const projectId = await this.resolveProjectId(dto.entityType, dto.entityId);
    await this.ensureProjectOwnership(projectId, userId);

    const rows = await this.prisma.$queryRaw<AttachmentRow[]>`
      INSERT INTO work_item_attachments (
        id,
        entity_type,
        entity_id,
        project_id,
        storage_path,
        file_name,
        mime_type,
        file_size,
        uploaded_by,
        created_at
      )
      VALUES (
        ${randomUUID()},
        ${dto.entityType},
        ${dto.entityId},
        ${projectId},
        ${dto.storagePath},
        ${dto.fileName},
        ${dto.mimeType},
        ${dto.fileSize},
        ${userId},
        NOW()
      )
      RETURNING
        id,
        entity_type AS "entityType",
        entity_id AS "entityId",
        project_id AS "projectId",
        storage_path AS "storagePath",
        file_name AS "fileName",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        uploaded_by AS "uploadedBy",
        created_at AS "createdAt"
    `;

    return this.toAttachmentEntity(rows[0]);
  }

  async findByEntity(userId: string, entityType: AttachmentEntityType, entityId: string): Promise<AttachmentEntity[]> {
    const projectId = await this.resolveProjectId(entityType, entityId);
    await this.ensureProjectOwnership(projectId, userId);

    const rows = await this.prisma.$queryRaw<AttachmentRow[]>`
      SELECT
        id,
        entity_type AS "entityType",
        entity_id AS "entityId",
        project_id AS "projectId",
        storage_path AS "storagePath",
        file_name AS "fileName",
        mime_type AS "mimeType",
        file_size AS "fileSize",
        uploaded_by AS "uploadedBy",
        created_at AS "createdAt"
      FROM work_item_attachments
      WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}
      ORDER BY created_at DESC
    `;

    return rows.map((row) => this.toAttachmentEntity(row));
  }

  private toAttachmentEntity(row: AttachmentRow): AttachmentEntity {
    return {
      ...row,
      fileSize: typeof row.fileSize === 'bigint' ? Number(row.fileSize) : row.fileSize,
    };
  }

  private async resolveProjectId(entityType: AttachmentEntityType, entityId: string): Promise<string> {
    if (entityType === 'TASK') {
      const rows = await this.prisma.$queryRaw<Array<{ projectId: string }>>`
        SELECT project_id AS "projectId"
        FROM tasks
        WHERE id = ${entityId}
        LIMIT 1
      `;

      if (rows.length === 0) {
        throw new NotFoundException('La tarea no existe para asociar adjuntos.');
      }

      return rows[0].projectId;
    }

    const rows = await this.prisma.$queryRaw<Array<{ projectId: string }>>`
      SELECT project_id AS "projectId"
      FROM bugs
      WHERE id = ${entityId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new NotFoundException('El bug no existe para asociar adjuntos.');
    }

    return rows[0].projectId;
  }

  private async ensureProjectOwnership(projectId: string, userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM projects
      WHERE id = ${projectId}
        AND owner_id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new ForbiddenException('No tienes permiso para este proyecto.');
    }
  }
}
