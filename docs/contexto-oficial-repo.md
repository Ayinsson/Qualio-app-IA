# Contexto oficial del repositorio

Este archivo define la fuente de verdad tecnica para agentes y colaboradores.

## 1) Estado oficial actual

- Base de datos oficial en este repo: **MySQL**.
- ORM oficial: **Prisma**.
- Backend: **NestJS** (`apps/api`).
- Frontend: **React + Vite + TypeScript** (`apps/web`).

## 2) Fuente de verdad (orden de prioridad)

Cuando exista conflicto, usar este orden:

1. Codigo y configuracion ejecutable (`package.json`, `schema.prisma`, configs de build/lint/test).
2. `AGENTS.md`.
3. Este archivo (`docs/contexto-oficial-repo.md`).
4. Documentos historicos o de fases en `docs/`.

## 3) Endpoints base vigentes

- Salud API: `GET /health`
- Salud DB: `GET /health/db`
- Auth:
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/logout`
  - `GET /auth/me`

## 4) Variables de entorno minimas

API (`apps/api/.env`):

```env
DATABASE_URL="mysql://qualio_user:Wcv4rT5s@localhost:3306/qualio_db"
JWT_SECRET="cambiar-por-valor-seguro"
PORT=3000
```

Frontend (`apps/web/.env`):

```env
VITE_API_URL="http://localhost:3000"
```

## 5) Documentos actuales recomendados

- `docs/Documentacion-tecnica-qualio-v1.0.md`
- `docs/manual-levantamiento-servicios-auth-front.md`
- `docs/plan-integracion-auth-end-to-end.md`
- `docs/pruebas-funcionales-login.md`

## 6) Nota de consistencia

La carpeta `docs/` fue depurada para mantener solo documentacion alineada al estado real actual del proyecto.
