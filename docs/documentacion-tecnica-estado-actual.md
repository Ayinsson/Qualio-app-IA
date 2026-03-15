# Qualio - Documentacion tecnica del estado actual

## 1. Resumen del proyecto

Qualio esta organizado como monorepo con dos aplicaciones:

- `apps/web`: frontend en React + Vite + TypeScript.
- `apps/api`: backend en NestJS + Prisma.

El proyecto ya tiene autenticacion funcional (registro, login, refresh, logout y endpoint protegido), con persistencia en PostgreSQL remoto de Supabase.

## 2. Arquitectura actual

### 2.1 Frontend (`apps/web`)

- React 19, Vite 6, TypeScript.
- Formularios con `react-hook-form` + `zod`.
- Cliente HTTP con `axios`.
- Cliente Supabase disponible en `src/lib/supabase.ts`.

### 2.2 Backend (`apps/api`)

- NestJS 11.
- Prisma Client.
- JWT para autenticacion.
- Hash de contrasenas con `argon2`.
- Validacion global con `ValidationPipe`.

## 3. Base de datos y proveedor actual

- Motor actual: **Supabase Postgres**.
- Prisma datasource:
  - `url = env("DATABASE_URL")`
  - `directUrl = env("DIRECT_URL")`

El backend usa tablas de autenticacion SQL existentes:

- `users`
- `refresh_tokens`

Script base disponible en:

- `apps/api/prisma/sql/init_auth_postgres.sql`

## 4. Estructura de carpetas

```text
.
|- apps/
|  |- web/
|  \- api/
|- docs/
|  \- documentacion-tecnica-estado-actual.md
|- AGENTS.md
|- README.md
|- package.json
```

## 5. Endpoints vigentes del backend

### 5.1 Salud

- `GET /health`
- `GET /health/db`

### 5.2 Autenticacion

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me` (protegido con bearer token)

## 6. Manejo de sesion y tokens

- `accessToken` con TTL de 15 minutos.
- `refreshToken` con TTL de 7 dias.
- Al refrescar sesion, el refresh token anterior se revoca.
- Logout marca token como revocado en base de datos.
- Frontend guarda:
  - `qualio_access_token`
  - `qualio_refresh_token`
  - `qualio_user`

Nota: aun no hay cierre por inactividad ni refresh automatico via interceptor en frontend.

## 7. Variables de entorno actuales

### 7.1 API (`apps/api/.env`)

```env
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres?sslmode=require"
JWT_SECRET="<JWT_SECRET>"
PORT=3000
```

### 7.2 Front (`apps/web/.env`)

```env
VITE_API_URL="http://localhost:3000"
VITE_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_xxx"
```

## 8. Comandos de desarrollo

Desde la raiz del repositorio:

- Instalar dependencias: `npm install`
- API dev: `npm run start:dev --workspace @qualio/api`
- Front dev: `npm run dev --workspace @qualio/web`
- Lint global: `npm run lint`
- Test global: `npm run test`
- Typecheck global: `npm run typecheck`
- Build global: `npm run build`

## 9. Inicializacion SQL de auth en Supabase

Desde `apps/api`:

```bash
npx prisma db execute --file "./prisma/sql/init_auth_postgres.sql" --schema "./prisma/schema.prisma"
```

Si la red bloquea el host directo de Supabase, usar pooler para `DIRECT_URL` temporalmente.

## 10. Estado funcional actual

### Implementado

- UI de login y registro conectada a API.
- Persistencia de usuarios/tokens en Postgres.
- Flujo auth base funcionando local con DB remota.

### Pendiente recomendado

- Refresh automatico de token en frontend.
- Cierre de sesion por inactividad.
- Rutas privadas completas post-login.
- Suite e2e de autenticacion mas amplia.

## 11. Criterio operativo para pruebas locales

Se considera entorno listo cuando:

1. `GET /health` responde `ok`.
2. `GET /health/db` responde `{"status":"ok","database":"supabase-postgres"}`.
3. Registro y login desde frontend funcionan.
