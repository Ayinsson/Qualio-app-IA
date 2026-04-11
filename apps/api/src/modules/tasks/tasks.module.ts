import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectMembersModule } from '../project-members/project-members.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [ProjectMembersModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
