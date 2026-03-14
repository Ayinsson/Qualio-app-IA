# Definicion funcional y plan MVP v0.1

## 1. Objetivo

Definir un MVP ejecutable de Qualio que permita gestionar pruebas de software de forma basica, con un flujo completo desde autenticacion hasta metricas iniciales por proyecto.

## 2. Resultado esperado de v0.1

Al finalizar esta version, un usuario debe poder:

- Iniciar sesion.
- Crear y administrar proyectos.
- Crear y administrar casos de prueba por proyecto.
- Registrar ejecuciones de casos de prueba.
- Consultar un dashboard minimo con metricas por estado.

## 3. Alcance funcional (incluido)

### 3.1 Autenticacion

- Login con JWT (access token).
- Proteccion de endpoints privados con guard.
- Usuario demo para entorno local.

### 3.2 Proyectos

- Crear proyecto.
- Listar proyectos.
- Ver detalle de proyecto.
- Editar nombre y descripcion.

### 3.3 Casos de prueba

- Crear caso de prueba asociado a proyecto.
- Listar casos por proyecto.
- Editar caso.
- Eliminar caso.

Campos minimos:

- Titulo.
- Pasos.
- Resultado esperado.
- Prioridad (`LOW | MEDIUM | HIGH`).
- Estado (`DRAFT | READY | ARCHIVED`).

### 3.4 Ejecuciones

- Registrar ejecucion de caso de prueba.
- Resultado de ejecucion (`PASSED | FAILED | BLOCKED`).
- Comentario opcional.
- Fecha de ejecucion.

### 3.5 Dashboard minimo

- Total de casos por estado en un proyecto.
- Total de ejecuciones por resultado en un proyecto.

## 4. Fuera de alcance (no incluido en v0.1)

- Roles avanzados y permisos granulares.
- Multi-tenant real.
- Notificaciones y automatizaciones.
- Integraciones externas (Jira, GitHub, CI).
- Generacion automatica de casos con IA en produccion.

## 5. Stack y estructura objetivo

- Frontend: React + Vite + TypeScript + React Router + TanStack Query + React Hook Form + Zod.
- Backend: NestJS (Express adapter) + Prisma + MySQL + class-validator.
- Documentacion: carpeta `docs` con setup, arquitectura y decisiones.

Estructura esperada:

```text
apps/
  web/
  api/
docs/
```

## 6. Modelo de datos minimo

### 6.1 Entidades

- `User`
  - `id`, `email`, `passwordHash`, `createdAt`
- `Project`
  - `id`, `name`, `description`, `ownerId`, `createdAt`
- `TestCase`
  - `id`, `projectId`, `title`, `steps`, `expectedResult`, `priority`, `status`, `createdAt`
- `TestExecution`
  - `id`, `testCaseId`, `result`, `notes`, `executedById`, `executedAt`

### 6.2 Reglas basicas

- Un proyecto pertenece a un usuario propietario.
- Un caso de prueba pertenece a un proyecto.
- Una ejecucion pertenece a un caso de prueba y a un usuario ejecutor.

## 7. API minima (v1)

- `POST /auth/login`
- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `GET /projects/:id/test-cases`
- `POST /projects/:id/test-cases`
- `PATCH /test-cases/:id`
- `DELETE /test-cases/:id`
- `POST /test-cases/:id/executions`
- `GET /projects/:id/dashboard`

Nota: documentar estos endpoints en Swagger desde el inicio.

## 8. Plan de entrega (2 semanas)

### Semana 1

- Dia 1: Scaffold de `apps/web` y `apps/api`, tooling base (TS, ESLint, Prettier).
- Dia 2: Prisma init, migracion inicial, seed basico.
- Dia 3: Login JWT (API) + pantalla de login (web).
- Dia 4: CRUD de proyectos (API + UI).
- Dia 5: CRUD de casos de prueba (API + UI).

### Semana 2

- Dia 6: Registro de ejecuciones de pruebas (API + UI).
- Dia 7: Dashboard minimo de proyecto.
- Dia 8: Validaciones, manejo de errores y hardening basico.
- Dia 9: Tests clave y ajustes de UX.
- Dia 10: Cierre tecnico (lint, test, build) + actualizacion de docs.

## 9. Criterios de aceptacion (DoD v0.1)

- Usuario puede autenticarse y consumir endpoints protegidos.
- CRUD de proyectos y casos funciona de extremo a extremo.
- Registro de ejecuciones funcional y visible en dashboard.
- Validaciones de entrada activas con mensajes utiles.
- Lint, test y build pasan en los modulos modificados.
- `.env.example` actualizado sin secretos reales.
- Documentacion minima de uso y arquitectura actualizada.

## 10. Backlog priorizado

### P0 (obligatorio para v0.1)

- Auth login JWT.
- Proyectos CRUD.
- Casos de prueba CRUD.
- Registro de ejecuciones.
- Dashboard minimo.

### P1 (si hay capacidad)

- Filtros por prioridad/estado.
- Paginacion de listados.
- Mejora de mensajes de error y estados de carga.

### P2 (post v0.1)

- Roles y permisos.
- Historial/auditoria de cambios.
- Integraciones externas.
- IA asistida para sugerencia de casos.

## 11. Riesgos y mitigaciones

- Riesgo: ampliar alcance durante sprint.
  - Mitigacion: congelar alcance P0 y mover extras a P1/P2.
- Riesgo: falta de contrato API temprano.
  - Mitigacion: definir endpoints y DTOs antes de UI avanzada.
- Riesgo: testing tardio.
  - Mitigacion: agregar pruebas por modulo desde su implementacion.
- Riesgo: configuraciones locales inconsistentes.
  - Mitigacion: reforzar `docs/local-setup.md.md` y `.env.example`.

## 12. Proximo hito sugerido (v0.2)

- Roles basicos (admin/tester/viewer).
- Filtros avanzados y busqueda.
- Export simple de resultados.
- Primer flujo asistido por IA en entorno controlado.
