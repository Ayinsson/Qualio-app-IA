import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { currentApiTokenId } from '../../common/request-context';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

export type CommentEntityType = 'TASK' | 'BUG';

export type CommentEntity = {
  id: string;
  entityType: CommentEntityType;
  entityId: string;
  projectId: string;
  body: string;
  authorId: string;
  authorName: string | null;
  authorEmail: string;
  authorAvatarUrl: string | null;
  /** Token de API con el que se escribió; null si fue desde la web. */
  apiTokenId: string | null;
  apiTokenName: string | null;
  createdAt: Date;
};

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, entityType: CommentEntityType, entityId: string): Promise<CommentEntity[]> {
    await this.resolveOwnedProjectId(userId, entityType, entityId);

    return this.prisma.$queryRaw<CommentEntity[]>`
      SELECT
        c.id,
        c.entity_type AS "entityType",
        c.entity_id AS "entityId",
        c.project_id AS "projectId",
        c.body,
        c.author_id AS "authorId",
        u.name AS "authorName",
        u.email AS "authorEmail",
        u.avatar_url AS "authorAvatarUrl",
        c.api_token_id AS "apiTokenId",
        t.name AS "apiTokenName",
        c.created_at AS "createdAt"
      FROM work_item_comments c
      JOIN users u ON u.id = c.author_id
      LEFT JOIN api_tokens t ON t.id = c.api_token_id
      WHERE c.entity_type = ${entityType}
        AND c.entity_id = ${entityId}
      ORDER BY c.created_at ASC
    `;
  }

  async create(
    userId: string,
    entityType: CommentEntityType,
    entityId: string,
    dto: CreateCommentDto,
  ): Promise<CommentEntity> {
    const body = dto.body.trim();

    if (!body) {
      throw new BadRequestException('El comentario no puede estar vacío.');
    }

    const projectId = await this.resolveOwnedProjectId(userId, entityType, entityId);
    const id = randomUUID();

    await this.prisma.$executeRaw`
      INSERT INTO work_item_comments (id, entity_type, entity_id, project_id, author_id, api_token_id, body, created_at)
      VALUES (${id}, ${entityType}, ${entityId}, ${projectId}, ${userId}, ${currentApiTokenId()}, ${body}, NOW())
    `;

    const rows = await this.prisma.$queryRaw<CommentEntity[]>`
      SELECT
        c.id,
        c.entity_type AS "entityType",
        c.entity_id AS "entityId",
        c.project_id AS "projectId",
        c.body,
        c.author_id AS "authorId",
        u.name AS "authorName",
        u.email AS "authorEmail",
        u.avatar_url AS "authorAvatarUrl",
        c.api_token_id AS "apiTokenId",
        t.name AS "apiTokenName",
        c.created_at AS "createdAt"
      FROM work_item_comments c
      JOIN users u ON u.id = c.author_id
      LEFT JOIN api_tokens t ON t.id = c.api_token_id
      WHERE c.id = ${id}
    `;

    return rows[0];
  }

  /** Igual que tareas y bugs: solo el dueño del proyecto accede a sus tickets. */
  private async resolveOwnedProjectId(userId: string, entityType: CommentEntityType, entityId: string): Promise<string> {
    const rows =
      entityType === 'TASK'
        ? await this.prisma.$queryRaw<Array<{ projectId: string; ownerId: string }>>`
            SELECT t.project_id AS "projectId", p.owner_id AS "ownerId"
            FROM tasks t
            JOIN projects p ON p.id = t.project_id
            WHERE t.id = ${entityId}
            LIMIT 1
          `
        : await this.prisma.$queryRaw<Array<{ projectId: string; ownerId: string }>>`
            SELECT b.project_id AS "projectId", p.owner_id AS "ownerId"
            FROM bugs b
            JOIN projects p ON p.id = b.project_id
            WHERE b.id = ${entityId}
            LIMIT 1
          `;

    const row = rows[0];

    if (!row) {
      throw new NotFoundException(entityType === 'TASK' ? 'Tarea no encontrada.' : 'Bug no encontrado.');
    }

    if (row.ownerId !== userId) {
      throw new ForbiddenException('No tienes permiso para este proyecto.');
    }

    return row.projectId;
  }
}
