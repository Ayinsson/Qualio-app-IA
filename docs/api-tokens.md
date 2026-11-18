# Tokens de API (acceso para integraciones y agentes de IA)

Los usuarios pueden generar tokens personales para consumir la API de Qualio desde scripts o agentes de IA.

## Formato y almacenamiento

- Formato: `qlo_` + 43 caracteres aleatorios (32 bytes en base64url).
- En la tabla `api_tokens` solo se guarda el hash SHA-256 (`token_hash`) y los primeros 12 caracteres (`token_prefix`) para reconocerlo.
- El token completo se devuelve una única vez, al crearlo.
- Vencimiento: `30d`, `90d` (por defecto), `365d` o `never`.
- Máximo 20 tokens activos por usuario. Límite de 120 peticiones por minuto por token (en memoria, por instancia).

## Gestión (solo con sesión web / JWT)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/auth/api-tokens` | Crea un token. Body: `{ "name": "Mi agente", "scopes": ["tickets:read"], "expiration": "90d" }` |
| `GET` | `/auth/api-tokens` | Lista los tokens del usuario (sin el valor del token) |
| `DELETE` | `/auth/api-tokens/:id` | Revoca un token |

Un token de API no puede crear, listar ni revocar tokens.

## Uso

```
Authorization: Bearer qlo_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`JwtOrApiTokenGuard` acepta el JWT de la web o un token `qlo_`. Con token de API, el endpoint debe declarar `@RequireScopes(...)` y el token debe tener todos esos permisos. Los endpoints sin `@RequireScopes` rechazan los tokens (denegado por defecto).

## Permisos (scopes)

| Scope | Endpoints |
| --- | --- |
| `projects:read` | `GET /projects`, `GET /projects/:id`, `GET /projects/:id/summary`, sprints (`GET`), reportes |
| `projects:write` | `POST /projects`, `PATCH /projects/:id`, `PATCH /projects/:id/archive`, `POST /projects/:id/sprints/start` |
| `tickets:read` | `GET /tickets`, `GET /tickets/:itemKey`, `GET /projects/:id/tasks`, `GET /projects/:id/bugs`, historial y comentarios (`GET /tasks/:id/comments`, `GET /bugs/:id/comments`) |
| `tickets:write` | Crear, editar, mover, cerrar y reabrir tareas y bugs |
| `comments:write` | `POST /tasks/:id/comments`, `POST /bugs/:id/comments` |
| `evidences:read` | `GET /attachments/:entityType/:entityId` |
| `evidences:write` | `POST /attachments` |

Invitaciones, miembros del proyecto y perfil de usuario siguen siendo exclusivos de la sesión web.

Igual que en la web, tareas, bugs, comentarios y evidencias solo son accesibles para el **dueño del proyecto**.

## Endpoints pensados para agentes

### `GET /tickets`: tareas y bugs de todos tus proyectos

| Parámetro | Valores | Por defecto |
| --- | --- | --- |
| `status` | `open` (tareas TODO/IN_PROGRESS, bugs OPEN/IN_PROGRESS), `closed`, `all` | `open` |
| `overdue` | `true`: abiertos con fecha límite anterior a hoy | — |
| `type` | `task`, `bug` | ambos |
| `assignedToMe` | `true`: tareas asignadas a ti (los bugs no tienen responsable) | — |
| `projectId` | id del proyecto. Sin él, solo proyectos activos (no archivados) | — |
| `priority` | `HIGH`, `MEDIUM`, `LOW` | — |
| `q` | texto a buscar en título o clave | — |
| `limit` | 1–200 | 50 |

Orden: primero los que tienen fecha límite (la más próxima arriba), luego por última edición. Cada ticket trae `type`, `itemKey`, `status`, `priority`, `dueDate`, `isOpen`, `isOverdue`, `projectName` y responsable.

### `GET /tickets/:itemKey`

Busca por clave sin importar mayúsculas (`/tickets/qa-12`) y devuelve el resumen más la descripción y, en bugs, ambiente y resultados esperado/obtenido. Con el `id` que devuelve se usan `PATCH /tasks/:id`, `PATCH /bugs/:id`, `PATCH /…/:id/reopen` y los comentarios.

### Comentarios

`POST /tasks/:id/comments` o `POST /bugs/:id/comments` con `{ "body": "texto" }` (1–5000 caracteres).

### Ejemplos

```bash
# Tickets vencidos
curl "http://localhost:3000/tickets?overdue=true" -H "Authorization: Bearer qlo_..."

# Comentar y cerrar un bug
curl -X POST http://localhost:3000/bugs/<id>/comments -H "Authorization: Bearer qlo_..." \
  -H "Content-Type: application/json" -d '{"body":"Verificado en staging."}'
curl -X PATCH http://localhost:3000/bugs/<id> -H "Authorization: Bearer qlo_..." \
  -H "Content-Type: application/json" -d '{"status":"CLOSED","changeNote":"Cerrado por el agente"}'
```

## Servidor MCP (agentes de IA)

El API expone un servidor [MCP](https://modelcontextprotocol.io) en `POST /mcp` (Streamable HTTP, sin estado, respuestas JSON). Así, Claude, Cursor, VS Code y otros agentes usan Qualio como herramienta, sin programar nada.

- **Autenticación:** solo tokens de API (`Authorization: Bearer qlo_…`). El JWT de la web se rechaza.
- **Herramientas por permiso:** cada herramienta aparece solo si el token tiene el permiso. Un token de solo lectura ni siquiera ve `close_ticket`.
- **Mismas reglas que la web:** las herramientas reutilizan los servicios del API, con el mismo acceso por dueño de proyecto, las mismas validaciones y el mismo historial. Todo queda marcado "vía <token>".
- **Código:** `apps/api/src/modules/mcp/`. `qualio-mcp.server.ts` define las herramientas.

| Herramienta | Permiso | Qué hace |
| --- | --- | --- |
| `list_projects` | `projects:read` | Lista proyectos (activos por defecto) |
| `get_project_summary` | `projects:read` | Avance de un proyecto |
| `list_tickets` | `tickets:read` | Igual que `GET /tickets`: abiertos, vencidos, asignados, búsqueda… |
| `get_ticket` | `tickets:read` | Detalle por clave con comentarios (y opcionalmente el historial) |
| `create_ticket` | `tickets:write` | Crea una tarea o reporta un bug |
| `update_ticket` | `tickets:write` | Cambia estado, prioridad, título, descripción, fecha límite o responsable (`me`/`nobody`) |
| `close_ticket` | `tickets:write` | Tarea a `DONE`, bug a `CLOSED` |
| `reopen_ticket` | `tickets:write` | Tarea a `TODO`, bug a `OPEN` (queda en el historial) |
| `comment_ticket` | `comments:write` | Comenta una tarea o bug |
| `list_evidences` | `evidences:read` | Archivos adjuntos de un ticket (solo los datos, no el archivo) |

### Conectar un agente

Al crear un token, la pantalla "Token creado" muestra estos fragmentos con el token ya incluido.

**Claude Code**

```bash
claude mcp add --transport http qualio http://localhost:3000/mcp --header "Authorization: Bearer qlo_..."
```

**Cursor, VS Code, Windsurf u otro cliente MCP con servidores HTTP**

```json
{
  "mcpServers": {
    "qualio": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer qlo_..." }
    }
  }
}
```

En producción, cambia `http://localhost:3000` por la URL pública del API (`VITE_API_URL` en el front).

## Trazabilidad

Cuando una petición entra con token de API, el guard guarda el id del token en un contexto por petición (`common/request-context.ts`, AsyncLocalStorage). Lo usan:

- `work_item_history.api_token_id`: cambios de tareas y bugs.
- `work_item_comments.api_token_id`: comentarios.

El historial y los comentarios devuelven `apiTokenName`, y la web lo muestra como "vía <nombre del token>".

## Base de datos

Las tablas `api_tokens` y `work_item_comments`, y las columnas `bugs.due_date` y `work_item_history.api_token_id`, están en `apps/api/prisma/sql/00_bootstrap_schema.sql`. Su RLS está en `01_supabase_rls_realtime_storage.sql`. Ambos scripts son idempotentes: en una base existente basta con `npm run db:bootstrap`.
