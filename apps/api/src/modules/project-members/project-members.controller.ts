import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ProjectMembersService, type ProjectMemberEntity } from './project-members.service';

@Controller('projects/:projectId/members')
@UseGuards(JwtAuthGuard)
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Get()
  list(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
  ): Promise<ProjectMemberEntity[]> {
    return this.projectMembersService.list(this.getUserId(req), projectId);
  }

  @Post()
  add(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ): Promise<ProjectMemberEntity[]> {
    return this.projectMembersService.add(this.getUserId(req), projectId, dto);
  }

  @Delete(':userId')
  remove(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ): Promise<{ success: true }> {
    return this.projectMembersService.remove(this.getUserId(req), projectId, userId);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    return userId;
  }
}
