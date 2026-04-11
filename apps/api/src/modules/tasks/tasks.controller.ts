import { Body, Controller, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CreateTaskDto, type BacklogSection } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskEntity, TaskHistoryEntry, TasksService } from './tasks.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectId/tasks')
  create(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskEntity> {
    return this.tasksService.create(this.getUserId(req), projectId, dto);
  }

  @Get('projects/:projectId/tasks')
  findAll(
    @Req() req: { user?: AuthPayload },
    @Param('projectId') projectId: string,
    @Query('section') section?: BacklogSection,
  ): Promise<TaskEntity[]> {
    return this.tasksService.findAll(this.getUserId(req), projectId, section);
  }

  @Patch('tasks/:id/move')
  move(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskEntity> {
    return this.tasksService.move(this.getUserId(req), id, dto);
  }

  @Patch('tasks/:id')
  update(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskEntity> {
    return this.tasksService.update(this.getUserId(req), id, dto);
  }

  @Patch('tasks/:id/reopen')
  reopen(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<TaskEntity> {
    return this.tasksService.reopen(this.getUserId(req), id);
  }

  @Get('tasks/:id/history')
  history(
    @Req() req: { user?: AuthPayload },
    @Param('id') id: string,
  ): Promise<TaskHistoryEntry[]> {
    return this.tasksService.history(this.getUserId(req), id);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesion invalida.');
    }

    return userId;
  }
}
