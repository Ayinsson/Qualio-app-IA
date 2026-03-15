import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): { status: string; service: string } {
    return this.appService.getHealth();
  }

  @Get('health/db')
  async getDatabaseHealth(): Promise<{ status: 'ok' | 'error'; database: 'supabase-postgres' }> {
    return this.appService.getDatabaseHealth();
  }
}
