import { ForbiddenException } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { AuthPayload } from '../../auth/auth.types';
import { QualioMcpServerFactory } from './qualio-mcp.server';

const TASK = { type: 'TASK', id: 't1', itemKey: 'Demo-001', status: 'TODO', isOpen: true };
const BUG = { type: 'BUG', id: 'b1', itemKey: 'Demo-002', status: 'CLOSED', isOpen: false };

function user(scopes: string[]): AuthPayload {
  return { sub: 'user-1', email: 'ana@qualio.test', authType: 'api_token', tokenId: 'tok-1', scopes };
}

function services() {
  return {
    projects: { findAll: jest.fn().mockResolvedValue([{ id: 'p1' }]), summary: jest.fn() },
    tickets: {
      list: jest.fn().mockResolvedValue([TASK]),
      findByKey: jest.fn((_user: string, key: string) => Promise.resolve(key === 'Demo-001' ? TASK : BUG)),
    },
    tasks: { create: jest.fn().mockResolvedValue({ id: 't9' }), update: jest.fn().mockResolvedValue({ id: 't1' }), history: jest.fn() },
    bugs: { create: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'b1' }), history: jest.fn() },
    comments: { list: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'c1' }) },
    attachments: { findByEntity: jest.fn().mockResolvedValue([]) },
  };
}

async function connect(scopes: string[], mocks = services()) {
  const factory = new QualioMcpServerFactory(
    mocks.projects as never,
    mocks.tickets as never,
    mocks.tasks as never,
    mocks.bugs as never,
    mocks.comments as never,
    mocks.attachments as never,
  );
  const server = factory.create(user(scopes));
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, mocks };
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  return (result.content as Array<{ text: string }>)[0].text;
}

describe('QualioMcpServerFactory', () => {
  it('only exposes the tools the token is allowed to use', async () => {
    const { client } = await connect(['tickets:read', 'comments:write']);
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(['comment_ticket', 'get_ticket', 'list_tickets']);
  });

  it('exposes every tool with full permissions', async () => {
    const { client } = await connect([
      'projects:read',
      'tickets:read',
      'tickets:write',
      'comments:write',
      'evidences:read',
    ]);
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(10);
    expect(tools.find((tool) => tool.name === 'list_tickets')?.annotations?.readOnlyHint).toBe(true);
  });

  it('maps list_tickets arguments to the REST filters', async () => {
    const { client, mocks } = await connect(['tickets:read']);
    await client.callTool({ name: 'list_tickets', arguments: { overdue: true, type: 'bug', query: 'pago' } });

    expect(mocks.tickets.list).toHaveBeenCalledWith('user-1', expect.objectContaining({ overdue: 'true', type: 'bug', q: 'pago' }));
  });

  it('closes a task as DONE and a bug as CLOSED, keeping the note', async () => {
    const { client, mocks } = await connect(['tickets:read', 'tickets:write']);

    await client.callTool({ name: 'close_ticket', arguments: { itemKey: 'Demo-001', changeNote: 'Verificado' } });
    expect(mocks.tasks.update).toHaveBeenCalledWith('user-1', 't1', expect.objectContaining({ status: 'DONE', changeNote: 'Verificado' }));

    mocks.tickets.findByKey.mockResolvedValueOnce({ ...BUG, isOpen: true, status: 'OPEN' });
    await client.callTool({ name: 'close_ticket', arguments: { itemKey: 'Demo-002' } });
    expect(mocks.bugs.update).toHaveBeenCalledWith('user-1', 'b1', expect.objectContaining({ status: 'CLOSED' }));
  });

  it('reopens closed tickets and explains when it is already open', async () => {
    const { client, mocks } = await connect(['tickets:write']);

    await client.callTool({ name: 'reopen_ticket', arguments: { itemKey: 'Demo-002' } });
    expect(mocks.bugs.update).toHaveBeenCalledWith('user-1', 'b1', expect.objectContaining({ status: 'OPEN' }));

    const already = await client.callTool({ name: 'reopen_ticket', arguments: { itemKey: 'Demo-001' } });
    expect(already.isError).toBe(true);
    expect(textOf(already)).toContain('ya está abierto');
  });

  it('rejects a status that does not belong to the ticket type', async () => {
    const { client, mocks } = await connect(['tickets:write']);
    const result = await client.callTool({ name: 'update_ticket', arguments: { itemKey: 'Demo-001', status: 'CLOSED' } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Estado no válido para una tarea');
    expect(mocks.tasks.update).not.toHaveBeenCalled();
  });

  it('assigns a task to the token owner with assignee "me"', async () => {
    const { client, mocks } = await connect(['tickets:write']);
    await client.callTool({ name: 'update_ticket', arguments: { itemKey: 'Demo-001', assignee: 'me', dueDate: null } });

    expect(mocks.tasks.update).toHaveBeenCalledWith('user-1', 't1', expect.objectContaining({ assignedTo: 'user-1', dueDate: null }));
  });

  it('requires reproduction steps to create a bug', async () => {
    const { client, mocks } = await connect(['tickets:write']);
    const result = await client.callTool({
      name: 'create_ticket',
      arguments: { projectId: 'p1', type: 'bug', title: 'Pago falla' },
    });

    expect(result.isError).toBe(true);
    expect(mocks.bugs.create).not.toHaveBeenCalled();
  });

  it('turns service errors into readable tool errors', async () => {
    const mocks = services();
    mocks.comments.create.mockRejectedValue(new ForbiddenException('No tienes permiso para este proyecto.'));
    const { client } = await connect(['comments:write'], mocks);
    const result = await client.callTool({ name: 'comment_ticket', arguments: { itemKey: 'Demo-001', body: 'Hola' } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('No tienes permiso para este proyecto.');
  });
});
