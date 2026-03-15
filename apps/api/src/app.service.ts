import { Injectable } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): { status: string; service: string } {
    return {
      status: 'ok',
      service: 'qualio-api',
    };
  }

  async getDatabaseHealth(): Promise<{ status: 'ok' | 'error'; database: 'supabase-postgres' }> {
    const connected = await this.prisma.checkConnection();

    return {
      status: connected ? 'ok' : 'error',
      database: 'supabase-postgres',
    };
  }
}
