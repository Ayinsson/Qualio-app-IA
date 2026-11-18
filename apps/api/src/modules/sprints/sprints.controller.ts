import { Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtOrApiTokenGuard } from '../../auth/jwt-or-api-token.guard';
import { RequireScopes } from '../../auth/require-scopes.decorator';
import { SprintEntity, SprintsService } from './sprints.service';

@Controller('projects/:projectId/sprints')
@UseGuards(JwtOrApiTokenGuard)
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get('active')
  @RequireScopes('projects:read')
  getActive(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<SprintEntity | null> {
    return this.sprintsService.getActive(this.getUserId(req), projectId);
  }

  @Get()
  @RequireScopes('projects:read')
  list(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<SprintEntity[]> {
    return this.sprintsService.list(this.getUserId(req), projectId);
  }

  @Post('start')
  @RequireScopes('projects:write')
  start(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<SprintEntity> {
    return this.sprintsService.start(this.getUserId(req), projectId);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesión inválida.');
    }

    return userId;
  }
}
