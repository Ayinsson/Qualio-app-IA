import { Body, Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtOrApiTokenGuard } from '../../auth/jwt-or-api-token.guard';
import { RequireScopes } from '../../auth/require-scopes.decorator';
import { CommentEntity, CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller()
@UseGuards(JwtOrApiTokenGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('tasks/:id/comments')
  @RequireScopes('tickets:read')
  listTaskComments(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<CommentEntity[]> {
    return this.commentsService.list(this.getUserId(req), 'TASK', id);
  }

  @Post('tasks/:id/comments')
  @RequireScopes('comments:write')
  commentTask(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentEntity> {
    return this.commentsService.create(this.getUserId(req), 'TASK', id, dto);
  }

  @Get('bugs/:id/comments')
  @RequireScopes('tickets:read')
  listBugComments(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<CommentEntity[]> {
    return this.commentsService.list(this.getUserId(req), 'BUG', id);
  }

  @Post('bugs/:id/comments')
  @RequireScopes('comments:write')
  commentBug(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentEntity> {
    return this.commentsService.create(this.getUserId(req), 'BUG', id, dto);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesión inválida.');
    }

    return userId;
  }
}
