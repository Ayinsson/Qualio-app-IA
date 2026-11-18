import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtOrApiTokenGuard } from '../../auth/jwt-or-api-token.guard';
import { RequireScopes } from '../../auth/require-scopes.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectSummaryDto } from './dto/project-summary.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectEntity, ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtOrApiTokenGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireScopes('projects:write')
  create(
    @Req() req: { user?: AuthPayload },
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectEntity> {
    return this.projectsService.create(this.getUserId(req), dto);
  }

  @Get()
  @RequireScopes('projects:read')
  findAll(
    @Req() req: { user?: AuthPayload },
    @Query('status') status?: 'ACTIVE' | 'ARCHIVED',
  ): Promise<ProjectEntity[]> {
    return this.projectsService.findAll(this.getUserId(req), status);
  }

  @Get(':id')
  @RequireScopes('projects:read')
  findOne(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
  ): Promise<ProjectEntity> {
    return this.projectsService.findOne(this.getUserId(req), id);
  }

  @Patch(':id')
  @RequireScopes('projects:write')
  update(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectEntity> {
    return this.projectsService.update(this.getUserId(req), id, dto);
  }

  @Patch(':id/archive')
  @RequireScopes('projects:write')
  archive(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
  ): Promise<ProjectEntity> {
    return this.projectsService.archive(this.getUserId(req), id);
  }

  @Get(':id/summary')
  @RequireScopes('projects:read')
  summary(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
  ): Promise<ProjectSummaryDto> {
    return this.projectsService.summary(this.getUserId(req), id);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesión inválida.');
    }

    return userId;
  }
}
