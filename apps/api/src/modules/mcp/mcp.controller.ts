import { All, Controller, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';

import { AuthPayload } from '../../auth/auth.types';
import { McpAuthGuard } from './mcp-auth.guard';
import { QualioMcpServerFactory } from './qualio-mcp.server';

/**
 * Endpoint MCP (Streamable HTTP, sin estado): cada petición crea un servidor
 * con las herramientas que permite el token y lo cierra al terminar.
 */
@Controller('mcp')
@UseGuards(McpAuthGuard)
export class McpController {
  constructor(private readonly serverFactory: QualioMcpServerFactory) {}

  @Post()
  async handle(@Req() req: Request & { user?: AuthPayload }, @Res() res: Response): Promise<void> {
    const server = this.serverFactory.create(req.user as AuthPayload);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  /** Sin sesiones no hay stream de notificaciones (GET) ni sesión que cerrar (DELETE). */
  @All()
  notAllowed(@Res() res: Response): void {
    res
      .status(HttpStatus.METHOD_NOT_ALLOWED)
      .set('Allow', 'POST')
      .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Método no permitido: usa POST.' }, id: null });
  }
}
