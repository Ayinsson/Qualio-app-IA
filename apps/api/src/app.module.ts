import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiTokensModule } from './auth/api-tokens/api-tokens.module';
import { AuthModule } from './auth/auth.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { BugsModule } from './modules/bugs/bugs.module';
import { CommentsModule } from './modules/comments/comments.module';
import { McpModule } from './modules/mcp/mcp.module';
import { PlanningModule } from './modules/planning/planning.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectMembersModule } from './modules/project-members/project-members.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ApiTokensModule,
    ProjectsModule,
    ReportsModule,
    NotificationsModule,
    InvitationsModule,
    ProjectMembersModule,
    SprintsModule,
    TasksModule,
    BugsModule,
    AttachmentsModule,
    CommentsModule,
    TicketsModule,
    McpModule,
    PlanningModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
