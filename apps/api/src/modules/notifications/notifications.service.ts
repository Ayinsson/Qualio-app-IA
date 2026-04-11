import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';

export type NotificationType =
  | 'INVITATION_PENDING'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REJECTED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'BUG_CREATED'
  | 'BUG_UPDATED';

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId: string | null;
  entityType: 'INVITATION' | 'TASK' | 'BUG' | null;
  entityId: string | null;
  actionType: 'INVITATION_RESPONSE' | null;
  actionId: string | null;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorAvatarUrl: string | null;
};

type NotificationPayload = {
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string | null;
  entityType?: 'INVITATION' | 'TASK' | 'BUG' | null;
  entityId?: string | null;
  actionType?: 'INVITATION_RESPONSE' | null;
  actionId?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
    const uniqueUsers = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueUsers.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      uniqueUsers.map((userId) =>
        this.prisma.$executeRaw`
          INSERT INTO notifications (
            id,
            user_id,
            type,
            title,
            message,
            project_id,
            entity_type,
            entity_id,
            action_type,
            action_id,
            is_read,
            created_at,
            read_at
          )
          VALUES (
            ${randomUUID()},
            ${userId},
            ${payload.type},
            ${payload.title},
            ${payload.message},
            ${payload.projectId ?? null},
            ${payload.entityType ?? null},
            ${payload.entityId ?? null},
            ${payload.actionType ?? null},
            ${payload.actionId ?? null},
            false,
            NOW(),
            NULL
          )
        `,
      ),
    );
  }

  async notifyProjectAudience(
    projectId: string,
    actorUserId: string,
    payload: NotificationPayload,
    includeActor = false,
  ): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      SELECT DISTINCT user_id AS "userId"
      FROM (
        SELECT owner_id AS user_id
        FROM projects
        WHERE id = ${projectId}
        UNION ALL
        SELECT user_id
        FROM project_members
        WHERE project_id = ${projectId}
      ) audience
    `;

    const users = rows.map((row) => row.userId).filter((userId) => includeActor || userId !== actorUserId);
    await this.createForUsers(users, payload);
  }

  async listForUser(userId: string, limit = 30, offset = 0): Promise<AppNotification[]> {
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    const normalizedOffset = Math.max(0, offset);

    return this.prisma.$queryRaw<AppNotification[]>`
      SELECT
        n.id,
        n.user_id AS "userId",
        n.type,
        n.title,
        n.message,
        n.project_id AS "projectId",
        n.entity_type AS "entityType",
        n.entity_id AS "entityId",
        n.action_type AS "actionType",
        n.action_id AS "actionId",
        n.is_read AS "isRead",
        n.created_at AS "createdAt",
        n.read_at AS "readAt",
        actor.id AS "actorUserId",
        actor.name AS "actorName",
        actor.email AS "actorEmail",
        actor.avatar_url AS "actorAvatarUrl"
      FROM notifications n
      LEFT JOIN project_invitations pi
        ON n.entity_type = 'INVITATION'
       AND n.entity_id = pi.id
      LEFT JOIN tasks t
        ON n.entity_type = 'TASK'
       AND n.entity_id = t.id
      LEFT JOIN bugs b
        ON n.entity_type = 'BUG'
       AND n.entity_id = b.id
      LEFT JOIN users actor
        ON actor.id = CASE
          WHEN n.type = 'INVITATION_PENDING' THEN pi.inviter_user_id
          WHEN n.type IN ('INVITATION_ACCEPTED', 'INVITATION_REJECTED') THEN pi.invited_user_id
          WHEN n.type = 'TASK_CREATED' THEN t.created_by
          WHEN n.type = 'TASK_UPDATED' THEN COALESCE(t.updated_by, t.created_by)
          WHEN n.type = 'BUG_CREATED' THEN b.reported_by
          WHEN n.type = 'BUG_UPDATED' THEN COALESCE(b.updated_by, b.reported_by)
          ELSE NULL
        END
      WHERE n.user_id = ${userId}
      ORDER BY n.created_at DESC
      LIMIT ${normalizedLimit}
      OFFSET ${normalizedOffset}
    `;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE notifications
      SET is_read = true,
          read_at = NOW()
      WHERE user_id = ${userId}
        AND is_read = false
    `;
  }
}
