import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { BugsController } from './bugs.controller';
import { BugsService } from './bugs.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BugsController],
  providers: [BugsService],
})
export class BugsModule {}
