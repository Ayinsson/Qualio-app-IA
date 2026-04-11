import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AppNotification, NotificationsService } from '../notifications/notifications.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

export type InvitationNotification = {
  id: string;
  projectId: string;
  projectName: string;
  inviterUserId: string;
  inviterName: string | null;
  inviterEmail: string;
  invitedEmail: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  isRead: boolean;
  createdAt: Date;
  respondedAt: Date | null;
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(ownerId: string, projectId: string, dto: CreateInvitationDto): Promise<InvitationNotification> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const email = dto.email.trim().toLowerCase();

    const ownerRows = await this.prisma.$queryRaw<Array<{ ownerId: string }>>`
      SELECT owner_id AS "ownerId"
      FROM projects
      WHERE id = ${projectId}
      LIMIT 1
    `;

    if (!ownerRows[0]) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    const ownerUserRows = await this.prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email
      FROM users
      WHERE id = ${ownerRows[0].ownerId}
      LIMIT 1
    `;

    if (ownerUserRows[0]?.email?.toLowerCase() === email) {
      throw new BadRequestException('No puedes invitar al propietario del proyecto.');
    }

    const userRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;

    const invitedUserId = userRows[0]?.id ?? null;

    if (!invitedUserId) {
      throw new BadRequestException('No existe una cuenta con ese correo.');
    }

    const duplicatedPendingRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM project_invitations
      WHERE project_id = ${projectId}
        AND (invited_user_id = ${invitedUserId} OR LOWER(invited_email) = ${email})
        AND status = 'PENDING'
      LIMIT 1
    `;

    if (duplicatedPendingRows.length > 0) {
      throw new BadRequestException('Esta persona ya tiene una invitacion pendiente para este proyecto.');
    }

    const alreadyMemberRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM project_members
      WHERE project_id = ${projectId}
        AND user_id = ${invitedUserId}
      LIMIT 1
    `;

    if (alreadyMemberRows.length > 0) {
      throw new BadRequestException('Esta persona ya participa en el proyecto.');
    }

    await this.prisma.$executeRaw`
      INSERT INTO project_invitations (
        id,
        project_id,
        inviter_user_id,
        invited_user_id,
        invited_email,
        role,
        status,
        is_read,
        created_at,
        responded_at
      )
      VALUES (
        ${randomUUID()},
        ${projectId},
        ${ownerId},
        ${invitedUserId},
        ${email},
        ${dto.role ?? 'MEMBER'},
        'PENDING',
        false,
        NOW(),
        NULL
      )
    `;

    const rows = await this.prisma.$queryRaw<InvitationNotification[]>`
      SELECT
        i.id,
        i.project_id AS "projectId",
        p.name AS "projectName",
        i.inviter_user_id AS "inviterUserId",
        inviter.name AS "inviterName",
        inviter.email AS "inviterEmail",
        i.invited_email AS "invitedEmail",
        i.role,
        i.status,
        i.is_read AS "isRead",
        i.created_at AS "createdAt",
        i.responded_at AS "respondedAt"
      FROM project_invitations i
      JOIN projects p ON p.id = i.project_id
      JOIN users inviter ON inviter.id = i.inviter_user_id
      WHERE i.project_id = ${projectId}
        AND i.invited_email = ${email}
      ORDER BY i.created_at DESC
      LIMIT 1
    `;

    const projectRows = await this.prisma.$queryRaw<Array<{ projectName: string; inviterName: string | null; inviterEmail: string }>>`
      SELECT
        p.name AS "projectName",
        u.name AS "inviterName",
        u.email AS "inviterEmail"
      FROM projects p
      JOIN users u ON u.id = ${ownerId}
      WHERE p.id = ${projectId}
      LIMIT 1
    `;

    const info = projectRows[0];
    if (info) {
      await this.notificationsService.createForUsers([invitedUserId], {
        type: 'INVITATION_PENDING',
        title: `Invitacion a ${info.projectName}`,
        message: `${info.inviterName?.trim() || info.inviterEmail} te invito como ${dto.role ?? 'MEMBER'}.`,
        projectId,
        entityType: 'INVITATION',
        entityId: rows[0].id,
        actionType: 'INVITATION_RESPONSE',
        actionId: rows[0].id,
      });
    }

    return rows[0];
  }

  async listForUser(userId: string, limit = 30, offset = 0): Promise<AppNotification[]> {
    await this.reconcilePendingInvitationsForUser(userId);
    return this.notificationsService.listForUser(userId, limit, offset);
  }

  async accept(userId: string, email: string, invitationId: string): Promise<{ success: true }> {
    const invitation = await this.getOwnedInvitation(userId, email, invitationId);

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('La invitacion ya fue procesada.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE project_invitations
        SET status = 'ACCEPTED',
            is_read = true,
            invited_user_id = ${userId},
            responded_at = NOW()
        WHERE id = ${invitationId}
      `;

      await tx.$executeRaw`
        INSERT INTO project_members (id, project_id, user_id, role, created_at)
        VALUES (${randomUUID()}, ${invitation.projectId}, ${userId}, ${invitation.role}, NOW())
        ON CONFLICT (project_id, user_id)
        DO NOTHING
      `;

      await tx.$executeRaw`
        DELETE FROM notifications
        WHERE entity_type = 'INVITATION'
          AND entity_id = ${invitationId}
          AND action_type = 'INVITATION_RESPONSE'
      `;
    });

    const actorRows = await this.prisma.$queryRaw<Array<{ name: string | null; email: string }>>`
      SELECT name, email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const projectRows = await this.prisma.$queryRaw<Array<{ ownerId: string; projectName: string }>>`
      SELECT owner_id AS "ownerId", name AS "projectName"
      FROM projects
      WHERE id = ${invitation.projectId}
      LIMIT 1
    `;

    const actor = actorRows[0];
    const project = projectRows[0];
    if (project?.ownerId) {
      await this.notificationsService.createForUsers([project.ownerId], {
        type: 'INVITATION_ACCEPTED',
        title: 'Invitacion aceptada',
        message: `${actor?.name?.trim() || actor?.email || 'Un usuario'} acepto tu invitacion a ${project.projectName}.`,
        projectId: invitation.projectId,
        entityType: 'INVITATION',
        entityId: invitationId,
      });
    }

    return { success: true };
  }

  async reject(userId: string, email: string, invitationId: string): Promise<{ success: true }> {
    const invitation = await this.getOwnedInvitation(userId, email, invitationId);

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('La invitacion ya fue procesada.');
    }

    await this.prisma.$executeRaw`
      UPDATE project_invitations
      SET status = 'REJECTED',
          is_read = true,
          invited_user_id = ${userId},
          responded_at = NOW()
      WHERE id = ${invitationId}
    `;

    await this.prisma.$executeRaw`
      DELETE FROM notifications
      WHERE entity_type = 'INVITATION'
        AND entity_id = ${invitationId}
        AND action_type = 'INVITATION_RESPONSE'
    `;

    const actorRows = await this.prisma.$queryRaw<Array<{ name: string | null; email: string }>>`
      SELECT name, email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const projectRows = await this.prisma.$queryRaw<Array<{ ownerId: string; projectName: string }>>`
      SELECT owner_id AS "ownerId", name AS "projectName"
      FROM projects
      WHERE id = ${invitation.projectId}
      LIMIT 1
    `;

    const actor = actorRows[0];
    const project = projectRows[0];
    if (project?.ownerId) {
      await this.notificationsService.createForUsers([project.ownerId], {
        type: 'INVITATION_REJECTED',
        title: 'Invitacion rechazada',
        message: `${actor?.name?.trim() || actor?.email || 'Un usuario'} rechazo tu invitacion a ${project.projectName}.`,
        projectId: invitation.projectId,
        entityType: 'INVITATION',
        entityId: invitationId,
      });
    }

    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: true }> {
    await this.notificationsService.markAllRead(userId);

    return { success: true };
  }

  async listPendingByProject(ownerId: string, projectId: string): Promise<InvitationNotification[]> {
    await this.ensureProjectOwnership(projectId, ownerId);

    return this.prisma.$queryRaw<InvitationNotification[]>`
      SELECT
        i.id,
        i.project_id AS "projectId",
        p.name AS "projectName",
        i.inviter_user_id AS "inviterUserId",
        inviter.name AS "inviterName",
        inviter.email AS "inviterEmail",
        i.invited_email AS "invitedEmail",
        i.role,
        i.status,
        i.is_read AS "isRead",
        i.created_at AS "createdAt",
        i.responded_at AS "respondedAt"
      FROM project_invitations i
      JOIN projects p ON p.id = i.project_id
      JOIN users inviter ON inviter.id = i.inviter_user_id
      WHERE i.project_id = ${projectId}
        AND i.status = 'PENDING'
      ORDER BY i.created_at DESC
    `;
  }

  async cancelByProject(ownerId: string, projectId: string, invitationId: string): Promise<{ success: true }> {
    await this.ensureProjectOwnership(projectId, ownerId);

    const rows = await this.prisma.$queryRaw<Array<{ id: string; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' }>>`
      SELECT id, status
      FROM project_invitations
      WHERE id = ${invitationId}
        AND project_id = ${projectId}
      LIMIT 1
    `;

    const invitation = rows[0];
    if (!invitation) {
      throw new NotFoundException('Invitacion no encontrada.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden cancelar invitaciones pendientes.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM notifications
        WHERE entity_type = 'INVITATION'
          AND entity_id = ${invitationId}
      `;

      await tx.$executeRaw`
        DELETE FROM project_invitations
        WHERE id = ${invitationId}
      `;
    });

    return { success: true };
  }

  private async getOwnedInvitation(userId: string, email: string, invitationId: string): Promise<{ projectId: string; role: 'ADMIN' | 'MEMBER'; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' }> {
    const rows = await this.prisma.$queryRaw<Array<{ projectId: string; role: 'ADMIN' | 'MEMBER'; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' }>>`
      SELECT
        project_id AS "projectId",
        role,
        status
      FROM project_invitations
      WHERE id = ${invitationId}
        AND (invited_user_id = ${userId} OR invited_email = ${email.toLowerCase()})
      LIMIT 1
    `;

    const invitation = rows[0];
    if (!invitation) {
      throw new ForbiddenException('No tienes acceso a esta invitacion.');
    }

    return invitation;
  }

  private async ensureProjectOwnership(projectId: string, ownerId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM projects
      WHERE id = ${projectId}
        AND owner_id = ${ownerId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new ForbiddenException('No tienes permiso para invitar en este proyecto.');
    }
  }

  private async reconcilePendingInvitationsForUser(userId: string): Promise<void> {
    const userRows = await this.prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const email = userRows[0]?.email?.trim().toLowerCase();
    if (!email) {
      return;
    }

    const pendingInvitations = await this.prisma.$queryRaw<
      Array<{
        id: string;
        projectId: string;
        projectName: string;
        inviterName: string | null;
        inviterEmail: string;
        role: 'ADMIN' | 'MEMBER';
        invitedUserId: string | null;
      }>
    >`
      SELECT
        i.id,
        i.project_id AS "projectId",
        p.name AS "projectName",
        inviter.name AS "inviterName",
        inviter.email AS "inviterEmail",
        i.role,
        i.invited_user_id AS "invitedUserId"
      FROM project_invitations i
      JOIN projects p ON p.id = i.project_id
      JOIN users inviter ON inviter.id = i.inviter_user_id
      WHERE i.status = 'PENDING'
        AND (
          i.invited_user_id = ${userId}
          OR (i.invited_user_id IS NULL AND LOWER(i.invited_email) = ${email})
        )
      ORDER BY i.created_at DESC
    `;

    if (pendingInvitations.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      pendingInvitations.map((invitation) =>
        this.prisma.$executeRaw`
          UPDATE project_invitations
          SET invited_user_id = ${userId}
          WHERE id = ${invitation.id}
            AND invited_user_id IS NULL
        `,
      ),
    );

    await this.prisma.$transaction(
      pendingInvitations.map((invitation) =>
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
          SELECT
            ${randomUUID()},
            ${userId},
            'INVITATION_PENDING',
            ${`Invitacion a ${invitation.projectName}`},
            ${`${invitation.inviterName?.trim() || invitation.inviterEmail} te invito como ${invitation.role}.`},
            ${invitation.projectId},
            'INVITATION',
            ${invitation.id},
            'INVITATION_RESPONSE',
            ${invitation.id},
            false,
            NOW(),
            NULL
          WHERE NOT EXISTS (
            SELECT 1
            FROM notifications n
            WHERE n.user_id = ${userId}
              AND n.entity_type = 'INVITATION'
              AND n.entity_id = ${invitation.id}
              AND n.action_type = 'INVITATION_RESPONSE'
          )
        `,
      ),
    );
  }
}
