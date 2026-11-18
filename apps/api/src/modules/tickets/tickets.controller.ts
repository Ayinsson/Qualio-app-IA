import { Controller, Get, Param, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import { AuthPayload } from '../../auth/auth.types';
import { JwtOrApiTokenGuard } from '../../auth/jwt-or-api-token.guard';
import { RequireScopes } from '../../auth/require-scopes.decorator';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { TicketDetail, TicketsService, TicketSummary } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtOrApiTokenGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @RequireScopes('tickets:read')
  list(@Req() req: { user?: AuthPayload }, @Query() query: ListTicketsQueryDto): Promise<TicketSummary[]> {
    return this.ticketsService.list(this.getUserId(req), query);
  }

  @Get(':itemKey')
  @RequireScopes('tickets:read')
  findByKey(@Req() req: { user?: AuthPayload }, @Param('itemKey') itemKey: string): Promise<TicketDetail> {
    return this.ticketsService.findByKey(this.getUserId(req), itemKey);
  }

  private getUserId(req: { user?: AuthPayload }): string {
    const userId = req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Sesión inválida.');
    }

    return userId;
  }
}
