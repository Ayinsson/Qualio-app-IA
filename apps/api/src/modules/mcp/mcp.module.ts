import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module';
import { BugsModule } from '../bugs/bugs.module';
import { CommentsModule } from '../comments/comments.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';
import { TicketsModule } from '../tickets/tickets.module';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpController } from './mcp.controller';
import { QualioMcpServerFactory } from './qualio-mcp.server';

@Module({
  imports: [ProjectsModule, TicketsModule, TasksModule, BugsModule, CommentsModule, AttachmentsModule],
  controllers: [McpController],
  providers: [QualioMcpServerFactory, McpAuthGuard],
})
export class McpModule {}
