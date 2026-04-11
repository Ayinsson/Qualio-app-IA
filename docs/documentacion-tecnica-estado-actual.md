# Qualio - Documentacion tecnica del estado actual

## 1. Resumen ejecutivo

Qualio opera como monorepo con dos apps:

- `apps/web` (React + Vite + TypeScript)
- `apps/api` (NestJS + Prisma)

El flujo de Proyectos + Backlog esta funcional en ambiente local:

- Creacion y gestion de proyectos.
- Gestion de participantes por invitacion.
- Backlog de tareas y bugs con create/list/update/move.
- Adjuntos con storage en Supabase y metadata en API.
- Historial de cambios por item (timeline en UI).
- Notificaciones reales (sin data demo) para invitaciones y actividad de trabajo.

---

## 2. Arquitectura vigente

### 2.1 Frontend (`apps/web`)

- React 19, Vite 6, TypeScript.
- `react-hook-form` para formularios.
- `@tanstack/react-query` para estado remoto y cache.
- Cliente HTTP con `axios`.
- Cliente Supabase en `apps/web/src/lib/supabase.ts`.
- Shell principal con sidebar, topbar, panel lateral de notificaciones y vistas por ruta.

### 2.2 Backend (`apps/api`)

- NestJS 11.
- Prisma Client para acceso DB, con consultas SQL directas mediante `$queryRaw` y `$executeRaw`.
- Autenticacion JWT (`accessToken` + `refreshToken`).
- Modulos activos: `projects`, `project-members`, `invitations`, `tasks`, `bugs`, `attachments`, `notifications`.

---

## 3. Base de datos (Supabase Postgres)

### 3.1 Tablas principales activas

- `users`
- `refresh_tokens`
- `projects`
- `project_members`
- `project_item_sequences`
- `project_invitations`
- `notifications`
- `tasks`
- `bugs`
- `work_item_attachments`
- `work_item_history`

### 3.2 Scripts SQL del repositorio

- `apps/api/prisma/sql/init_auth_postgres.sql`
- `apps/api/prisma/sql/init_projects_postgres.sql`
- `apps/api/prisma/sql/init_tasks_bugs_postgres.sql`

Nota: `work_item_history` y columnas de auditoria (`updated_by`, `last_change_note`) deben existir en DB. Si no estan creadas, usar el SQL de la seccion 9.

---

## 4. Endpoints backend vigentes

Todos estos endpoints usan `JwtAuthGuard`.

### 4.1 Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /auth/profile`
- `PATCH /auth/password`
- `PATCH /auth/avatar`

### 4.2 Projects

- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `PATCH /projects/:id/archive`
- `GET /projects/:id/summary`

### 4.3 Project Members

- `GET /projects/:projectId/members`
- `POST /projects/:projectId/members`
- `DELETE /projects/:projectId/members/:userId`

### 4.4 Invitations + Notifications feed

- `POST /projects/:projectId/invitations`
- `GET /invitations/notifications?limit=&offset=`
- `PATCH /invitations/:id/accept`
- `PATCH /invitations/:id/reject`
- `PATCH /invitations/read-all`

### 4.5 Tasks

- `POST /projects/:projectId/tasks`
- `GET /projects/:projectId/tasks`
- `PATCH /tasks/:id/move`
- `PATCH /tasks/:id`
- `GET /tasks/:id/history`

### 4.6 Bugs

- `POST /projects/:projectId/bugs`
- `GET /projects/:projectId/bugs`
- `PATCH /bugs/:id/move`
- `PATCH /bugs/:id`
- `GET /bugs/:id/history`

### 4.7 Attachments

- `POST /attachments`
- `GET /attachments/:entityType/:entityId`

---

## 5. Estado funcional del modulo proyectos/backlog

### Implementado

- Crear proyecto y listar proyectos activos/archivados.
- Vista de detalle de proyecto con tabs (`Backlog`, `Tablero`, `Completado`, `Reportes`).
- Crear tarea y bug desde menu `+ Crear`.
- Item key por proyecto (`<codigo>-001`, `<codigo>-002`, ...).
- Backlog dividido en `NEXT_SPRINT` y `GENERAL_BACKLOG`.
- Drag and drop entre secciones y reorder dentro de cada seccion.
- Edicion de tarea/bug desde modal de detalle.
- Timeline de historial por item en el modal.
- Participantes por proyecto e invitaciones.
- Asignacion de tarea por `assigned_to` usando `userId` real.
- Avatar de responsable en backlog (imagen, iniciales o icono por defecto).
- Subida de adjuntos y preview inline (imagen/video) en detalle.

### Notificaciones

- Panel lateral de notificaciones desde la campana en topbar.
- Feed real consumido desde backend (`/invitations/notifications`).
- Filtros por categoria (`Todo`, `Invitaciones`, `Tareas`, `Bugs`) con contadores.
- Agrupacion por dia (`Hoy`, `Ayer`, fecha).
- Acciones `Aceptar` y `Rechazar` para invitaciones pendientes.
- Vista `Colaborar > Invitaciones` conectada al mismo feed real.

---

## 6. Eventos que publican notificaciones

La tabla `notifications` funciona como stream unificado para UI.

### 6.1 Invitaciones

- `INVITATION_PENDING`: cuando se crea invitacion y el usuario invitado existe.
- `INVITATION_ACCEPTED`: cuando el invitado acepta.
- `INVITATION_REJECTED`: cuando el invitado rechaza.

Para invitaciones pendientes se usa:

- `action_type = 'INVITATION_RESPONSE'`
- `action_id = <invitationId>`

Esto habilita botones de accion en frontend.

### 6.2 Tareas

- `TASK_CREATED`: al crear tarea.
- `TASK_UPDATED`: al actualizar o mover tarea.

### 6.3 Bugs

- `BUG_CREATED`: al crear bug.
- `BUG_UPDATED`: al actualizar o mover bug.

---

## 7. Consideraciones tecnicas relevantes

- El backend valida acceso al proyecto antes de listar/editar entidades.
- `assigned_to` en `tasks` referencia `users(id)`; la UI envia UUID de usuario.
- `file_size` en adjuntos se normaliza para evitar errores de serializacion `BigInt` en respuestas JSON.
- El upload de archivo ocurre desde frontend a Supabase Storage y luego se registra metadata via API.
- Para QA local, las politicas RLS del bucket deben permitir la operacion esperada del cliente anon/autenticado.

---

## 8. Comandos base de trabajo

Desde raiz:

- `npm install`
- `npm run start:dev --workspace @qualio/api`
- `npm run dev --workspace @qualio/web`
- `npm run lint --workspace @qualio/api`
- `npm run lint --workspace @qualio/web`
- `npm run build --workspace @qualio/api`
- `npm run build --workspace @qualio/web`
- `npm run test --workspace @qualio/web -- --run`

---

## 9. SQL de referencia para historial (si falta en DB)

Ejecutar solo si la base actual no tiene estas estructuras.

```sql
ALTER TABLE IF EXISTS tasks
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36),
  ADD COLUMN IF NOT EXISTS last_change_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'tasks'
      AND constraint_name = 'fk_tasks_updated_by'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT fk_tasks_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE IF EXISTS bugs
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36),
  ADD COLUMN IF NOT EXISTS last_change_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'bugs'
      AND constraint_name = 'fk_bugs_updated_by'
  ) THEN
    ALTER TABLE bugs
      ADD CONSTRAINT fk_bugs_updated_by
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS work_item_history (
  id VARCHAR(36) PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  changed_by VARCHAR(36) NOT NULL,
  field_name VARCHAR(60) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_work_item_history_entity_type CHECK (entity_type IN ('TASK', 'BUG')),
  CONSTRAINT fk_work_item_history_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_work_item_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wih_entity ON work_item_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wih_project ON work_item_history(project_id);
CREATE INDEX IF NOT EXISTS idx_wih_created_at ON work_item_history(created_at);
```

---

## 10. Variables de entorno

### API (`apps/api/.env`)

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
JWT_SECRET="..."
PORT=3000
```

### Web (`apps/web/.env`)

```env
VITE_API_URL="http://localhost:3000"
VITE_SUPABASE_URL="https://<project>.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_xxx"
```
