import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AppNotification } from '../notifications/notifications.service';
import { InvitationNotification, InvitationsService } from './invitations.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('projects/:projectId/invitations')
  create(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<InvitationNotification> {
    return this.invitationsService.create(this.getUserId(req), projectId, dto);
  }

  @Get('projects/:projectId/invitations/pending')
  listPendingByProject(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<InvitationNotification[]> {
    return this.invitationsService.listPendingByProject(this.getUserId(req), projectId);
  }

  @Delete('projects/:projectId/invitations/:invitationId')
  cancelByProject(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<{ success: true }> {
    return this.invitationsService.cancelByProject(this.getUserId(req), projectId, invitationId);
  }

  @Get('invitations/notifications')
  list(
    @Req() req: { user?: AuthPayload },
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ): Promise<AppNotification[]> {
    const payload = this.getUser(req);
    const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 30;
    const offset = Number.isFinite(Number(offsetRaw)) ? Number(offsetRaw) : 0;
    return this.invitationsService.listForUser(payload.sub, limit, offset);
  }

  @Patch('invitations/:id/accept')
  accept(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<{ success: true }> {
    const payload = this.getUser(req);
    return this.invitationsService.accept(payload.sub, payload.email, id);
  }

  @Patch('invitations/:id/reject')
  reject(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<{ success: true }> {
    const payload = this.getUser(req);
    return this.invitationsService.reject(payload.sub, payload.email, id);
  }

  @Patch('invitations/read-all')
  markAllRead(@Req() req: { user?: AuthPayload }): Promise<{ success: true }> {
    const payload = this.getUser(req);
    return this.invitationsService.markAllRead(payload.sub);
  }

  private getUser(req: { user?: AuthPayload }): AuthPayload {
    const payload = req.user;

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    return payload;
  }

  private getUserId(req: { user?: AuthPayload }): string {
    return this.getUser(req).sub;
  }
}
