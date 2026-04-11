import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AttachmentsService, type AttachmentEntity } from './attachments.service';
import { ATTACHMENT_ENTITY_TYPES, type AttachmentEntityType, CreateAttachmentDto } from './dto/create-attachment.dto';

@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  create(@Req() req: { user?: AuthPayload }, @Body() dto: CreateAttachmentDto): Promise<AttachmentEntity> {
    return this.attachmentsService.create(this.getUserId(req), dto);
  }

  @Get(':entityType/:entityId')
  findByEntity(
    @Req() req: { user?: AuthPayload },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<AttachmentEntity[]> {
    const normalized = entityType.toUpperCase();

    if (!ATTACHMENT_ENTITY_TYPES.includes(normalized as AttachmentEntityType)) {
      throw new UnauthorizedException('Tipo de entidad no valido.');
    }

    return this.attachmentsService.findByEntity(this.getUserId(req), normalized as AttachmentEntityType, entityId);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    return userId;
  }
}
