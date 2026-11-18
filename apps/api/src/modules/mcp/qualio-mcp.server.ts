import { HttpException, Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { type ApiTokenScope } from '../../auth/api-tokens/api-token-scopes';
import { AuthPayload } from '../../auth/auth.types';
import { AttachmentsService } from '../attachments/attachments.service';
import { BugsService } from '../bugs/bugs.service';
import { UpdateBugDto } from '../bugs/dto/update-bug.dto';
import { CommentsService } from '../comments/comments.service';
import { ProjectsService } from '../projects/projects.service';
import { type BacklogSection } from '../tasks/dto/create-task.dto';
import { UpdateTaskDto } from '../tasks/dto/update-task.dto';
import { TasksService } from '../tasks/tasks.service';
import { TicketDetail, TicketsService } from '../tickets/tickets.service';

const SERVER_INSTRUCTIONS = `Qualio es una herramienta de QA para gestionar proyectos, tareas y bugs.
- Los tickets se identifican por su clave (itemKey), por ejemplo "Checkout-012". Usa list_tickets para encontrarlas.
- Estados de tarea: TODO, IN_PROGRESS, DONE. Estados de bug: OPEN, IN_PROGRESS, RESOLVED, CLOSED.
- "Abierto" = tarea TODO/IN_PROGRESS o bug OPEN/IN_PROGRESS. "Vencido" = abierto con fecha límite anterior a hoy.
- Todo lo que hagas queda registrado en el historial a nombre del usuario y marcado con el nombre de este token.
- Antes de cerrar o cambiar un ticket, confirma con el usuario si no lo pidió de forma explícita.`;

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')
  .describe('Fecha en formato AAAA-MM-DD.');
const ITEM_KEY = z.string().min(1).max(80).describe('Clave del ticket, por ejemplo "Checkout-012".');
const NOTE = z.string().max(500).optional().describe('Nota del cambio que queda en el historial.');

const DESTINATIONS: Record<'backlog' | 'next_sprint' | 'sprint_board', BacklogSection> = {
  backlog: 'GENERAL_BACKLOG',
  next_sprint: 'NEXT_SPRINT',
  sprint_board: 'SPRINT_BOARD',
};
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
const BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

type ToolConfig<Shape extends z.ZodRawShape> = {
  title: string;
  description: string;
  inputSchema: Shape;
  annotations: Record<string, boolean>;
};

/**
 * Registra una herramienta con tipos simples. Inferir los genéricos de
 * McpServer.registerTool (compatibles con zod 3 y 4) agota la memoria de tsc.
 */
function addTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: ToolConfig<Shape>,
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<CallToolResult>,
): void {
  const register = server.registerTool.bind(server) as unknown as (
    toolName: string,
    toolConfig: ToolConfig<Shape>,
    callback: (args: unknown) => Promise<CallToolResult>,
  ) => void;
  register(name, config, (args) => handler(args as z.infer<z.ZodObject<Shape>>));
}

/** Error pensado para el agente: se devuelve como resultado de la herramienta, no como fallo del protocolo. */
class ToolError extends Error {}

/**
 * Arma el servidor MCP de Qualio para un usuario y su token. Las herramientas
 * reutilizan los servicios del API, así que aplican las mismas reglas de acceso.
 */
@Injectable()
export class QualioMcpServerFactory {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tickets: TicketsService,
    private readonly tasks: TasksService,
    private readonly bugs: BugsService,
    private readonly comments: CommentsService,
    private readonly attachments: AttachmentsService,
  ) {}

  create(user: AuthPayload): McpServer {
    const server = new McpServer({ name: 'qualio', version: '1.0.0' }, { instructions: SERVER_INSTRUCTIONS });
    const userId = user.sub;
    const can = (scope: ApiTokenScope) => (user.scopes ?? []).includes(scope);

    if (can('projects:read')) {
      addTool(
        server,
        'list_projects',
        {
          title: 'Listar proyectos',
          description: 'Lista tus proyectos de Qualio (activos por defecto).',
          inputSchema: { status: z.enum(['ACTIVE', 'ARCHIVED']).optional() },
          annotations: READ_ONLY,
        },
        ({ status }) => run(() => this.projects.findAll(userId, status ?? 'ACTIVE')),
      );

      addTool(
        server,
        'get_project_summary',
        {
          title: 'Resumen del proyecto',
          description: 'Avance de un proyecto: conteo de tareas y bugs por estado y sprint activo.',
          inputSchema: { projectId: z.string().min(1).max(36) },
          annotations: READ_ONLY,
        },
        ({ projectId }) => run(() => this.projects.summary(userId, projectId)),
      );
    }

    if (can('tickets:read')) {
      addTool(
        server,
        'list_tickets',
        {
          title: 'Listar tickets',
          description:
            'Busca tareas y bugs en todos tus proyectos. Por defecto devuelve los abiertos, primero los de fecha límite más próxima.',
          inputSchema: {
            status: z.enum(['open', 'closed', 'all']).optional().describe('Por defecto "open".'),
            overdue: z.boolean().optional().describe('Solo abiertos con fecha límite anterior a hoy.'),
            type: z.enum(['task', 'bug']).optional(),
            assignedToMe: z.boolean().optional().describe('Solo tareas asignadas a ti (los bugs no tienen responsable).'),
            projectId: z.string().max(36).optional(),
            priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
            query: z.string().max(100).optional().describe('Texto a buscar en el título o la clave.'),
            limit: z.number().int().min(1).max(200).optional().describe('Por defecto 50.'),
          },
          annotations: READ_ONLY,
        },
        (args) =>
          run(() =>
            this.tickets.list(userId, {
              status: args.status,
              overdue: args.overdue ? 'true' : undefined,
              type: args.type,
              assignedToMe: args.assignedToMe ? 'true' : undefined,
              projectId: args.projectId,
              priority: args.priority,
              q: args.query,
              limit: args.limit,
            }),
          ),
      );

      addTool(
        server,
        'get_ticket',
        {
          title: 'Ver ticket',
          description: 'Detalle de un ticket por su clave, con descripción y comentarios. Opcionalmente su historial.',
          inputSchema: { itemKey: ITEM_KEY, includeHistory: z.boolean().optional() },
          annotations: READ_ONLY,
        },
        ({ itemKey, includeHistory }) =>
          run(async () => {
            const ticket = await this.tickets.findByKey(userId, itemKey);
            const comments = await this.comments.list(userId, ticket.type, ticket.id);
            const history = includeHistory
              ? ticket.type === 'TASK'
                ? await this.tasks.history(userId, ticket.id)
                : await this.bugs.history(userId, ticket.id)
              : undefined;
            return { ...ticket, comments, ...(history ? { history } : {}) };
          }),
      );
    }

    if (can('tickets:write')) {
      addTool(
        server,
        'create_ticket',
        {
          title: 'Crear ticket',
          description: 'Crea una tarea o reporta un bug en un proyecto.',
          inputSchema: {
            projectId: z.string().min(1).max(36),
            type: z.enum(['task', 'bug']),
            title: z.string().min(3).max(200),
            description: z
              .string()
              .max(4000)
              .optional()
              .describe('En bugs es obligatoria: pasos para reproducir (mínimo 8 caracteres).'),
            priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
            dueDate: DATE.optional(),
            destination: z
              .enum(['backlog', 'next_sprint', 'sprint_board'])
              .optional()
              .describe('Dónde queda. Por defecto el backlog general.'),
            assignToMe: z.boolean().optional().describe('Solo tareas.'),
            environment: z.string().max(120).optional().describe('Solo bugs, por ejemplo "Staging".'),
            expectedResult: z.string().max(4000).optional().describe('Solo bugs.'),
            actualResult: z.string().max(4000).optional().describe('Solo bugs.'),
          },
          annotations: WRITE,
        },
        (args) =>
          run(() => {
            const section = DESTINATIONS[args.destination ?? 'backlog'];
            if (args.type === 'task') {
              return this.tasks.create(userId, args.projectId, {
                title: args.title,
                description: args.description,
                priority: args.priority,
                section,
                dueDate: args.dueDate,
                assignedTo: args.assignToMe ? userId : undefined,
              });
            }
            if (!args.description || args.description.trim().length < 8) {
              throw new ToolError('Un bug necesita la descripción con los pasos para reproducirlo (mínimo 8 caracteres).');
            }
            return this.bugs.create(userId, args.projectId, {
              title: args.title,
              description: args.description,
              priority: args.priority,
              section,
              dueDate: args.dueDate,
              environment: args.environment,
              expectedResult: args.expectedResult,
              actualResult: args.actualResult,
            });
          }),
      );

      addTool(
        server,
        'update_ticket',
        {
          title: 'Actualizar ticket',
          description:
            'Cambia estado, prioridad, título, descripción, fecha límite o responsable de un ticket. Solo envía lo que cambia.',
          inputSchema: {
            itemKey: ITEM_KEY,
            status: z
              .enum([...TASK_STATUSES, 'OPEN', 'RESOLVED', 'CLOSED'])
              .optional()
              .describe('Tarea: TODO, IN_PROGRESS, DONE. Bug: OPEN, IN_PROGRESS, RESOLVED, CLOSED.'),
            priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
            title: z.string().min(3).max(200).optional(),
            description: z.string().max(4000).optional(),
            dueDate: DATE.nullable().optional().describe('AAAA-MM-DD, o null para quitarla.'),
            assignee: z.enum(['me', 'nobody']).optional().describe('Solo tareas: asignártela o dejarla sin responsable.'),
            changeNote: NOTE,
          },
          annotations: WRITE,
        },
        ({ itemKey, ...changes }) =>
          run(async () => {
            const ticket = await this.tickets.findByKey(userId, itemKey);
            return this.applyUpdate(userId, ticket, changes);
          }),
      );

      addTool(
        server,
        'close_ticket',
        {
          title: 'Cerrar ticket',
          description: 'Marca una tarea como DONE o un bug como CLOSED (usa update_ticket para RESOLVED).',
          inputSchema: { itemKey: ITEM_KEY, changeNote: NOTE },
          annotations: { ...WRITE, idempotentHint: true },
        },
        ({ itemKey, changeNote }) =>
          run(async () => {
            const ticket = await this.tickets.findByKey(userId, itemKey);
            return this.applyUpdate(userId, ticket, { status: ticket.type === 'TASK' ? 'DONE' : 'CLOSED', changeNote });
          }),
      );

      addTool(
        server,
        'reopen_ticket',
        {
          title: 'Reabrir ticket',
          description: 'Reabre un ticket terminado: la tarea vuelve a TODO o el bug a OPEN, en el backlog general.',
          inputSchema: { itemKey: ITEM_KEY, changeNote: NOTE },
          annotations: { ...WRITE, idempotentHint: true },
        },
        ({ itemKey, changeNote }) =>
          run(async () => {
            const ticket = await this.tickets.findByKey(userId, itemKey);
            if (ticket.isOpen) {
              throw new ToolError(`${ticket.itemKey} ya está abierto (${ticket.status}).`);
            }
            return this.applyUpdate(userId, ticket, { status: ticket.type === 'TASK' ? 'TODO' : 'OPEN', changeNote });
          }),
      );
    }

    if (can('comments:write')) {
      addTool(
        server,
        'comment_ticket',
        {
          title: 'Comentar ticket',
          description: 'Agrega un comentario a una tarea o bug. Se muestra con el nombre de este token.',
          inputSchema: { itemKey: ITEM_KEY, body: z.string().min(1).max(5000) },
          annotations: WRITE,
        },
        ({ itemKey, body }) =>
          run(async () => {
            const ticket = await this.tickets.findByKey(userId, itemKey);
            return this.comments.create(userId, ticket.type, ticket.id, { body });
          }),
      );
    }

    if (can('evidences:read')) {
      addTool(
        server,
        'list_evidences',
        {
          title: 'Listar evidencias',
          description: 'Lista los archivos adjuntos (evidencias) de un ticket: nombre, tipo, tamaño y fecha.',
          inputSchema: { itemKey: ITEM_KEY },
          annotations: READ_ONLY,
        },
        ({ itemKey }) =>
          run(async () => {
            const ticket = await this.tickets.findByKey(userId, itemKey);
            const files = await this.attachments.findByEntity(userId, ticket.type, ticket.id);
            return files.map(({ id, fileName, mimeType, fileSize, uploadedBy, createdAt }) => ({
              id,
              fileName,
              mimeType,
              fileSize,
              uploadedBy,
              createdAt,
            }));
          }),
      );
    }

    return server;
  }

  private applyUpdate(
    userId: string,
    ticket: TicketDetail,
    changes: {
      status?: string;
      priority?: 'HIGH' | 'MEDIUM' | 'LOW';
      title?: string;
      description?: string;
      dueDate?: string | null;
      assignee?: 'me' | 'nobody';
      changeNote?: string;
    },
  ) {
    const common = {
      title: changes.title,
      description: changes.description,
      priority: changes.priority,
      dueDate: changes.dueDate,
      changeNote: changes.changeNote,
    };

    if (ticket.type === 'TASK') {
      if (changes.status && !(TASK_STATUSES as readonly string[]).includes(changes.status)) {
        throw new ToolError(`Estado no válido para una tarea: ${changes.status}. Usa TODO, IN_PROGRESS o DONE.`);
      }
      const dto: UpdateTaskDto = {
        ...common,
        status: changes.status as UpdateTaskDto['status'],
        assignedTo: changes.assignee === 'me' ? userId : changes.assignee === 'nobody' ? null : undefined,
      };
      return this.tasks.update(userId, ticket.id, dto);
    }

    if (changes.status && !(BUG_STATUSES as readonly string[]).includes(changes.status)) {
      throw new ToolError(`Estado no válido para un bug: ${changes.status}. Usa OPEN, IN_PROGRESS, RESOLVED o CLOSED.`);
    }
    if (changes.assignee) {
      throw new ToolError('Los bugs no tienen responsable; assignee solo aplica a tareas.');
    }
    if (changes.description !== undefined && changes.description.trim().length < 8) {
      throw new ToolError('La descripción de un bug necesita al menos 8 caracteres.');
    }
    const dto: UpdateBugDto = { ...common, status: changes.status as UpdateBugDto['status'] };
    return this.bugs.update(userId, ticket.id, dto);
  }
}

/** Ejecuta la herramienta y convierte el resultado (o el error) en texto para el agente. */
export async function run(action: () => Promise<unknown> | unknown): Promise<CallToolResult> {
  try {
    const data = await action();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: toolErrorMessage(error) }] };
  }
}

function toolErrorMessage(error: unknown): string {
  if (error instanceof ToolError) {
    return error.message;
  }
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const message = typeof response === 'object' && response !== null ? (response as { message?: unknown }).message : response;
    return Array.isArray(message) ? message.join(' ') : String(message ?? error.message);
  }
  return 'Ocurrió un error inesperado en Qualio.';
}
