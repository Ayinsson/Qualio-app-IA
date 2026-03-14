# Documentacion tecnica Qualio v1.0

## 1. Alcance de este documento

Este documento describe unicamente el estado actual del repositorio local `Qualio-app-IA`.

- Rama analizada: `dev`.
- Referencia de commit base: `dba804e`.
- Estado del workspace al momento del analisis: existe 1 archivo nuevo sin commit (`docs/roadmaps-login-registro.md`).

No incluye diseno futuro ni funcionalidades no implementadas.

## 2. Paradigma y enfoque de construccion actual

El proyecto esta construido como monorepo JavaScript/TypeScript con separacion por aplicaciones:

- `apps/web`: cliente web (SPA) en React.
- `apps/api`: API backend en NestJS.

Enfoque tecnico vigente:

- Arquitectura por capas basica (UI -> servicio API, API -> servicios -> persistencia).
- Tipado estricto con TypeScript en frontend y backend.
- Validacion de formularios en frontend con `react-hook-form` + `zod`.
- Persistencia modelada con Prisma para MySQL.
- Calidad por scripts de lint, test, typecheck y build por workspace.

## 3. Estructura del repositorio

Estructura detectada:

```text
.
|- AGENTS.md
|- README.md
|- package.json
|- package-lock.json
|- tsconfig.base.json
|- .env.example
|- .gitignore
|- apps/
|  |- web/
|  \- api/
\- docs/
```

Detalles relevantes de carpetas:

- `apps/web/dist` y `apps/api/dist` existen por builds locales.
- `node_modules` existe en raiz y en apps (instalacion local ya realizada).

## 4. Orquestacion del monorepo (raiz)

Archivo principal: `package.json`.

- Workspaces npm activos:
  - `apps/web`
  - `apps/api`
- Scripts de orquestacion:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
  - `npm run test`
  - `npm run typecheck`
- Version de Node esperada: `>=20`.

Configuracion TypeScript base compartida (`tsconfig.base.json`):

- `target: ES2022`
- `module: ESNext`
- `moduleResolution: Bundler`
- `strict: true`

## 5. Frontend actual (`apps/web`)

### 5.1 Stack y herramientas

- React 19
- Vite 6
- TypeScript 5
- React Router (dependencia instalada, aun no usada en codigo)
- TanStack Query (provider configurado)
- React Hook Form + Zod
- Vitest + Testing Library
- ESLint flat config

### 5.2 Entrada y composicion

Archivos clave:

- `apps/web/src/main.tsx`: monta `App` con `QueryClientProvider`.
- `apps/web/src/App.tsx`: interfaz actual de Login/Registro (modo demo local).
- `apps/web/src/styles.css`: estilos responsive del modulo auth.

### 5.3 Logica funcional implementada

La pantalla actual permite:

- Alternar entre formularios de `Login` y `Registro`.
- Validar campos con reglas de Zod.
- Mostrar errores de validacion por campo.
- Mostrar mensaje de feedback local tras envio valido.

Estado real de integracion:

- No hay llamadas HTTP a backend.
- No hay persistencia de token/sesion.
- No hay rutas privadas en frontend.

### 5.4 Testing frontend

- Archivo: `apps/web/src/App.test.tsx`.
- Cobertura funcional actual: render basico de encabezado/mensaje del componente.
- Runner: `vitest run`.

## 6. Backend actual (`apps/api`)

### 6.1 Stack y herramientas

- NestJS 11
- Prisma Client 6
- class-validator / class-transformer (instalados)
- Jest + ts-jest + supertest
- ESLint flat config (CommonJS)

### 6.2 Modulos y endpoints implementados

Archivos clave:

- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/app.controller.ts`
- `apps/api/src/app.service.ts`

Estado funcional:

- Existe un endpoint de salud:
  - `GET /health`
  - respuesta: `{ "status": "ok", "service": "qualio-api" }`
- No existe aun modulo de autenticacion.
- No existen aun endpoints de registro/login reales.

### 6.3 Testing backend

- Unit test: `apps/api/src/app.service.spec.ts`.
- E2E test: `apps/api/test/app.e2e-spec.ts`.
- Config e2e: `apps/api/test/jest-e2e.json`.

Cobertura actual:

- Verifica `AppService.getHealth()`.
- Verifica `GET /health` via supertest.

## 7. Capa de datos (Prisma)

Archivo: `apps/api/prisma/schema.prisma`.

### 7.1 Datasource

- Proveedor: MySQL.
- Conexion via variable `DATABASE_URL`.

### 7.2 Modelos definidos

- `User`
  - `id`, `email` (unico), `passwordHash`, `createdAt`
  - relaciones: `ownedProjects`, `executions`
- `Project`
  - `id`, `name`, `description`, `ownerId`, `createdAt`
  - relacion con `User` y `TestCase`
- `TestCase`
  - `id`, `projectId`, `title`, `steps`, `expectedResult`, `priority`, `status`, `createdAt`
  - relacion con `Project` y `TestExecution`
- `TestExecution`
  - `id`, `testCaseId`, `result`, `notes`, `executedById`, `executedAt`
  - relacion con `TestCase` y `User`

### 7.3 Enums

- `TestPriority`: `LOW | MEDIUM | HIGH`
- `TestCaseStatus`: `DRAFT | READY | ARCHIVED`
- `ExecutionResult`: `PASSED | FAILED | BLOCKED`

Estado actual de migraciones:

- No se detectan migraciones versionadas en carpeta `migrations/`.
- El esquema esta definido, pero la capa auth aun no consume Prisma en servicios.

## 8. Configuracion y entorno

Archivo `/.env.example` incluye:

- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `PORT`
- `VITE_API_URL`

Archivo `/.gitignore` vigente ignora:

- Dependencias y artefactos (`node_modules`, `dist`, `coverage`, `*.tsbuildinfo`).
- Archivos de entorno sensibles (`.env*local`).
- Artefactos TS generados para web (`apps/web/*.js`, `apps/web/*.d.ts`).

## 9. Calidad de codigo y convenciones tecnicas actuales

### 9.1 Lint

- Front: `apps/web/eslint.config.js`
  - Reglas base JS + TypeScript + React Hooks.
- API: `apps/api/eslint.config.cjs`
  - Reglas base JS + TypeScript.

### 9.2 Typecheck

- Front: `tsc --noEmit`.
- API: `tsc --noEmit`.

### 9.3 Build

- Front: `tsc --noEmit && vite build`.
- API: `nest build`.

## 10. Flujo funcional real de la version actual

Flujo disponible hoy:

1. Levantar frontend y backend con scripts npm.
2. Registrar usuario desde frontend con `POST /auth/register`.
3. Iniciar sesion desde frontend con `POST /auth/login`.
4. Validar sesion protegida con `GET /auth/me` usando token Bearer.
5. Refrescar token con `POST /auth/refresh` y cerrar sesion con `POST /auth/logout`.
6. Consultar `GET /health` y `GET /health/db` en backend.

Limitaciones actuales de la version:

- Aun no existe auto-refresh de token en frontend mediante interceptor.
- Aun no existe cierre por inactividad de usuario en frontend.
- Aun no existe dashboard/routing privado completo post-login.

## 11. Documentacion disponible en `docs`

Documentos presentes:

- `docs/Definicion.md`: definicion de MVP v0.1.
- `docs/roadmaps-login-registro.md`: roadmap funcional simple para auth.
- `docs/estructura-bd-login-qualio.md`: estructura de base de datos para auth.
- `docs/plan-integracion-auth-end-to-end.md`: plan tecnico por PR para auth.
- `docs/pruebas-funcionales-login.md`: set de pruebas funcionales de login/sesion/token.
- `docs/manual-levantamiento-servicios-auth-front.md`: manual para levantar servicios y probar auth.
- `docs/contexto-oficial-repo.md`: fuente de verdad documental vigente.

## 12. Conclusiones tecnicas del estado actual

El repositorio se encuentra en fase de base funcional inicial:

- Monorepo y tooling ya operativos.
- Frontend de autenticacion conectado a endpoints reales de auth.
- Backend activo con salud API/DB y modulo auth funcional.
- Modelo de datos y flujo de tokens activos sobre MySQL.

La siguiente fase recomendada es robustecer la sesion en frontend (auto-refresh, rutas protegidas completas y politica de inactividad).
