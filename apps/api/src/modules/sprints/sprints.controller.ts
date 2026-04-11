import { Controller, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SprintEntity, SprintsService } from './sprints.service';

@Controller('projects/:projectId/sprints')
@UseGuards(JwtAuthGuard)
export class SprintsController {
  constructor(private readonly sprintsService: SprintsService) {}

  @Get('active')
  getActive(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<SprintEntity | null> {
    return this.sprintsService.getActive(this.getUserId(req), projectId);
  }

  @Get()
  list(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<SprintEntity[]> {
    return this.sprintsService.list(this.getUserId(req), projectId);
  }

  @Post('start')
  start(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<SprintEntity> {
    return this.sprintsService.start(this.getUserId(req), projectId);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    return userId;
  }
}
