import { Global, Module } from '@nestjs/common';

import { ApiTokensController } from './api-tokens.controller';
import { ApiTokensService } from './api-tokens.service';

/**
 * Global para que JwtOrApiTokenGuard pueda resolver ApiTokensService en
 * cualquier módulo que lo use con @UseGuards.
 */
@Global()
@Module({
  controllers: [ApiTokensController],
  providers: [ApiTokensService],
  exports: [ApiTokensService],
})
export class ApiTokensModule {}
