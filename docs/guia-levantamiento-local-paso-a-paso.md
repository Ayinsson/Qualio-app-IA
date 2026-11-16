# Guia de levantamiento local paso a paso

Esta guia explica como levantar Qualio en local y probar el flujo funcional de autenticacion.

## 1. Requisitos previos

Antes de iniciar, valida:

- Node.js 20+
- npm instalado
- Acceso a internet (la base de datos esta en Supabase)
- Variables de entorno configuradas

## 2. Variables de entorno

## 2.1 API (`apps/api/.env`)

```env
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require"
JWT_SECRET="<TU_CLAVE_SEGURA>"
PORT=3000
```

## 2.2 Frontend (`apps/web/.env`)

```env
VITE_API_URL="http://localhost:3000"
VITE_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_xxx"
```

## 3. Instalar dependencias

Desde la raiz del repo:

```bash
npm install
```

## 4. Inicializar base de datos (proyecto Supabase nuevo)

Desde `apps/api`, con el `.env` ya apuntando al proyecto nuevo:

```bash
npm run db:bootstrap
```

Esto ejecuta, en orden:

1. `prisma/sql/00_bootstrap_schema.sql`: crea las 12 tablas (users, refresh_tokens, projects, project_members, project_item_sequences, project_invitations, notifications, sprints, tasks, bugs, work_item_history, work_item_attachments). Es idempotente.
2. `prisma/sql/01_supabase_rls_realtime_storage.sql`: activa RLS en todas las tablas, publica `notifications` en Realtime y crea los buckets `avatars` (publico) y `project-assets` (privado) con sus politicas.

Opcional, datos demo para reportes (requiere al menos un usuario registrado):

```bash
npm run db:seed:reports
```

Los scripts `init_*.sql` y `alter_users_add_avatar_url.sql` quedan solo como historico; para una base nueva usa unicamente los `00_` y `01_`.

Si aparece error de conectividad con `:5432`, usa temporalmente el host pooler tambien en `DIRECT_URL`.

## 5. Levantar servicios (2 terminales)

## Terminal 1 - API

Desde la raiz del repo:

```bash
npm run start:dev --workspace @qualio/api
```

Resultado esperado: API en `http://localhost:3000`.

## Terminal 2 - Frontend

Desde la raiz del repo:

```bash
npm run dev --workspace @qualio/web
```

Resultado esperado: Front en `http://localhost:5173` o puerto alterno de Vite.

## 6. Verificaciones tecnicas minimas

En una tercera terminal:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```

Esperado:

- `health` -> estado `ok`
- `health/db` -> `{"status":"ok","database":"supabase-postgres"}`

## 7. Prueba funcional desde el navegador

1. Abre la URL del frontend.
2. Ir a `Registro` y crear un usuario nuevo.
3. Ir a `Login` e iniciar sesion con ese usuario.
4. Verificar mensaje de exito en UI.

## 8. Validar sesion en navegador

En DevTools -> Application -> Local Storage, confirmar:

- `qualio_access_token`
- `qualio_refresh_token`
- `qualio_user`

## 9. Probar endpoints auth manualmente (opcional)

## 9.1 Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"qa.local@qualio.dev","password":"Password123","name":"QA Local"}'
```

## 9.2 Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa.local@qualio.dev","password":"Password123"}'
```

## 9.3 Me (con bearer token)

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 9.4 Refresh

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

## 9.5 Logout

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

## 10. Problemas comunes

## Error `P1012` (DATABASE_URL no encontrada)

- Verificar que existe `apps/api/.env`.
- Ejecutar comandos de Prisma desde `apps/api`.

## Error `P1001` (no conecta a BD)

- Revisar credenciales.
- Revisar que Supabase proyecto este activo.
- Probar `DIRECT_URL` con pooler si tu red bloquea `:5432`.

## Front no conecta a API

- Verificar `VITE_API_URL`.
- Reiniciar frontend luego de cambiar `.env`.

## 11. Criterio final de listo

El entorno local esta correcto cuando:

1. API y front levantan sin error.
2. `health` y `health/db` responden `ok`.
3. Registro/login funcionan en UI.
4. Tokens se guardan en Local Storage.
