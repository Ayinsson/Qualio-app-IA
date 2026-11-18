import { Body, Controller, Delete, Get, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../auth.types';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { ApiTokenEntity, ApiTokensService, CreatedApiToken } from './api-tokens.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';

/**
 * Gestión de tokens de API. Usa solo JwtAuthGuard a propósito: un token de API
 * no puede crear, listar ni revocar tokens; eso requiere la sesión web.
 */
@Controller('auth/api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Post()
  create(@Req() req: { user?: AuthPayload }, @Body() dto: CreateApiTokenDto): Promise<CreatedApiToken> {
    return this.apiTokensService.create(this.getUserId(req), dto);
  }

  @Get()
  list(@Req() req: { user?: AuthPayload }): Promise<ApiTokenEntity[]> {
    return this.apiTokensService.list(this.getUserId(req));
  }

  @Delete(':id')
  revoke(@Req() req: { user?: AuthPayload }, @Param('id') id: string): Promise<{ success: true }> {
    return this.apiTokensService.revoke(this.getUserId(req), id);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesión inválida.');
    }

    return userId;
  }
}
