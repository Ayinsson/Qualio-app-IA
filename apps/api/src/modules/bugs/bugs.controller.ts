import { Body, Controller, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { type BacklogSection } from '../tasks/dto/create-task.dto';
import { BugsService, type BugEntity, type BugHistoryEntry } from './bugs.service';
import { CreateBugDto } from './dto/create-bug.dto';
import { MoveBugDto } from './dto/move-bug.dto';
import { UpdateBugDto } from './dto/update-bug.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class BugsController {
  constructor(private readonly bugsService: BugsService) {}

  @Post('projects/:projectId/bugs')
  create(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Body() dto: CreateBugDto,
  ): Promise<BugEntity> {
    return this.bugsService.create(this.getUserId(req), projectId, dto);
  }

  @Get('projects/:projectId/bugs')
  findAll(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Query('section') section?: BacklogSection,
  ): Promise<BugEntity[]> {
    return this.bugsService.findAll(this.getUserId(req), projectId, section);
  }

  @Patch('bugs/:id/move')
  move(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: MoveBugDto,
  ): Promise<BugEntity> {
    return this.bugsService.move(this.getUserId(req), id, dto);
  }

  @Patch('bugs/:id')
  update(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: UpdateBugDto,
  ): Promise<BugEntity> {
    return this.bugsService.update(this.getUserId(req), id, dto);
  }

  @Patch('bugs/:id/reopen')
  reopen(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<BugEntity> {
    return this.bugsService.reopen(this.getUserId(req), id);
  }

  @Get('bugs/:id/history')
  history(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
  ): Promise<BugHistoryEntry[]> {
    return this.bugsService.history(this.getUserId(req), id);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    return userId;
  }
}
