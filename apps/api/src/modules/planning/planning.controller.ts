import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtOrApiTokenGuard } from '../../auth/jwt-or-api-token.guard';
import { RequireScopes } from '../../auth/require-scopes.decorator';
import { CreateStageDto, CreateStageGroupDto, UpdateStageDto, UpdateStageGroupDto } from './dto/planning.dto';
import { PlanningService, PlanningView, StageGroupRecord, StageRecord } from './planning.service';

@Controller()
@UseGuards(JwtOrApiTokenGuard)
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('projects/:projectId/planning')
  @RequireScopes('projects:read')
  getPlanning(@Req() req: { user?: AuthPayload }, @Param('projectId') projectId: string): Promise<PlanningView> {
    return this.planningService.getPlanning(this.getUserId(req), projectId);
  }

  @Post('projects/:projectId/stages')
  @RequireScopes('projects:write')
  createStage(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Body() dto: CreateStageDto,
  ): Promise<StageRecord> {
    return this.planningService.createStage(this.getUserId(req), projectId, dto);
  }

  @Patch('stages/:id')
  @RequireScopes('projects:write')
  updateStage(@Req() req: { user?: AuthPayload }, @Param('id') id: string, @Body() dto: UpdateStageDto): Promise<StageRecord> {
    return this.planningService.updateStage(this.getUserId(req), id, dto);
  }

  @Delete('stages/:id')
  @RequireScopes('projects:write')
  deleteStage(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<{ success: true }> {
    return this.planningService.deleteStage(this.getUserId(req), id);
  }

  @Post('stages/:stageId/groups')
  @RequireScopes('projects:write')
  createGroup(
    @Req() req: { user?: AuthPayload },
    @Param('stageId') stageId: string,
    @Body() dto: CreateStageGroupDto,
  ): Promise<StageGroupRecord> {
    return this.planningService.createGroup(this.getUserId(req), stageId, dto);
  }

  @Patch('stage-groups/:id')
  @RequireScopes('projects:write')
  updateGroup(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: UpdateStageGroupDto,
  ): Promise<StageGroupRecord> {
    return this.planningService.updateGroup(this.getUserId(req), id, dto);
  }

  @Delete('stage-groups/:id')
  @RequireScopes('projects:write')
  deleteGroup(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<{ success: true }> {
    return this.planningService.deleteGroup(this.getUserId(req), id);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesión inválida.');
    }

    return userId;
  }
}
