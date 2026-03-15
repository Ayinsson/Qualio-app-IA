# Módulo de Proyectos de Qualio – Estructura Inicial para OpenCode

## 1. Propósito del documento

Este documento define la estructura funcional, reglas, relaciones, modelo de datos inicial y lineamientos de implementación del **módulo de proyectos** de Qualio para su primera fase.

Su objetivo es servir como base clara para que el agente OpenCode pueda construir el módulo de forma coherente con el estado actual del proyecto, su MVP y la arquitectura ya definida.

---

## 2. Contexto actual de Qualio

Qualio ya cuenta con una base técnica activa:

- Frontend en **React + Vite + TypeScript**.
- Backend en **NestJS + Prisma**.
- Base de datos en **Supabase Postgres**.
- Autenticación funcional con usuario autenticado y sesión gestionada con JWT.

Esto implica que el módulo de proyectos debe construirse como una extensión natural del sistema autenticado actual y respetar la arquitectura monorepo existente.

---

## 3. Rol del módulo de proyectos dentro del MVP

Dentro del MVP de Qualio, el proyecto es el **contenedor principal de trabajo**.  
A partir de un proyecto se organizan los principales objetos del sistema:

- Tareas
- Casos de prueba
- Bugs
- Más adelante: ejecuciones, métricas y dashboard

En términos funcionales, el proyecto debe actuar como la unidad raíz sobre la cual se agrupa toda la operación de testing.

---

## 4. Objetivo funcional del módulo

Permitir que un usuario autenticado pueda:

1. Crear proyectos.
2. Visualizar sus proyectos.
3. Consultar el detalle de un proyecto.
4. Editar la información básica del proyecto.
5. Eliminar o archivar proyectos.
6. Gestionar dentro del proyecto objetos relacionados como tareas, casos de prueba y bugs.
7. Visualizar contadores y métricas básicas del proyecto.

---

## 5. Requerimiento base del proyecto

Un proyecto en su fase inicial requiere como mínimo:

- **Nombre** (obligatorio)
- **Logo** (opcional)
- **Dueño** (automático; corresponde al usuario que lo crea)

El proyecto será un objeto que contiene otros objetos de dominio:

- **Tareas**
- **Casos de prueba**
- **Bugs**

Cada uno de estos objetos tendrá sus propios atributos, validaciones y estados.

---

## 6. Definición de la entidad principal: Project

### 6.1 Descripción

`Project` es la entidad raíz del módulo.  
Representa un espacio lógico de trabajo donde el usuario organiza y controla la actividad de calidad relacionada con un producto, módulo o esfuerzo de pruebas.

### 6.2 Atributos mínimos iniciales

| Campo | Tipo sugerido | Obligatorio | Descripción |
|---|---|---:|---|
| `id` | string / uuid | Sí | Identificador único del proyecto |
| `name` | string | Sí | Nombre del proyecto |
| `logoUrl` | string nullable | No | Ruta o URL del logo del proyecto |
| `ownerId` | string / uuid | Sí | Usuario dueño del proyecto |
| `status` | enum | Sí | Estado del proyecto |
| `createdAt` | datetime | Sí | Fecha de creación |
| `updatedAt` | datetime | Sí | Fecha de última actualización |

### 6.3 Estados sugeridos para Project

- `ACTIVE`
- `ARCHIVED`

En la primera fase no se recomienda añadir muchos estados adicionales para mantener la lógica simple.

---

## 7. Reglas de negocio del proyecto

### 7.1 Reglas obligatorias

1. El proyecto debe ser creado solo por un **usuario autenticado**.
2. El campo `name` es obligatorio.
3. El `ownerId` no se envía desde frontend; se toma del usuario autenticado en backend.
4. El `logo` es opcional.
5. Un usuario puede crear múltiples proyectos.
6. En esta fase, un proyecto tiene **un solo dueño**.
7. Solo el dueño del proyecto puede editarlo o eliminarlo, salvo que en una fase futura se implemente manejo de roles.
8. No debe existir un proyecto sin `ownerId`.
9. El sistema debe registrar automáticamente `createdAt` y `updatedAt`.
10. Si se elimina un proyecto, debe definirse una política clara para sus objetos hijos.

### 7.2 Reglas recomendadas para la fase inicial

1. El nombre del proyecto debe tener longitud mínima sugerida de 3 caracteres.
2. Se recomienda una longitud máxima entre 80 y 120 caracteres.
3. El logo debe aceptar formatos controlados, por ejemplo `png`, `jpg`, `jpeg`, `webp`.
4. El tamaño máximo del archivo de logo debe ser limitado.
5. El sistema debe devolver errores claros de validación cuando falte el nombre o el usuario no tenga acceso.

---

## 8. Relaciones principales del módulo

### 8.1 Relación con usuario

- Un `User` puede tener muchos `Project`.
- Un `Project` pertenece a un solo `User` como dueño en la fase inicial.

Relación:

```text
User 1 ─── N Project
```

### 8.2 Relación con tareas

- Un `Project` puede tener muchas `Task`.
- Cada `Task` pertenece a un solo `Project`.

Relación:

```text
Project 1 ─── N Task
```

### 8.3 Relación con casos de prueba

- Un `Project` puede tener muchos `TestCase`.
- Cada `TestCase` pertenece a un solo `Project`.

Relación:

```text
Project 1 ─── N TestCase
```

### 8.4 Relación con bugs

- Un `Project` puede tener muchos `Bug`.
- Cada `Bug` pertenece a un solo `Project`.

Relación:

```text
Project 1 ─── N Bug
```

### 8.5 Relación adicional futura

Más adelante puede agregarse:

- `Project 1 ─── N TestRun`
- `Project 1 ─── N Member`
- `Project 1 ─── N Attachment`
- `Project 1 ─── N ActivityLog`

Estas relaciones no son necesarias para la fase inicial.

---

## 9. Objetos internos contenidos por Project

## 9.1 Task

### Propósito
Representar actividades de trabajo, pendientes o acciones internas del proyecto.

### Campos iniciales sugeridos

| Campo | Tipo sugerido | Obligatorio | Descripción |
|---|---|---:|---|
| `id` | string / uuid | Sí | Identificador único |
| `projectId` | string / uuid | Sí | Proyecto al que pertenece |
| `title` | string | Sí | Título de la tarea |
| `description` | string nullable | No | Descripción detallada |
| `status` | enum | Sí | Estado de la tarea |
| `priority` | enum | Sí | Prioridad |
| `createdBy` | string / uuid | Sí | Usuario creador |
| `assignedTo` | string / uuid nullable | No | Usuario asignado |
| `dueDate` | datetime nullable | No | Fecha límite |
| `createdAt` | datetime | Sí | Fecha de creación |
| `updatedAt` | datetime | Sí | Fecha de actualización |

### Enums sugeridos

#### `TaskStatus`
- `TODO`
- `IN_PROGRESS`
- `DONE`

#### `TaskPriority`
- `LOW`
- `MEDIUM`
- `HIGH`

---

## 9.2 TestCase

### Propósito
Representar un caso de prueba que permite validar una funcionalidad dentro del proyecto.

### Campos iniciales sugeridos

| Campo | Tipo sugerido | Obligatorio | Descripción |
|---|---|---:|---|
| `id` | string / uuid | Sí | Identificador único |
| `projectId` | string / uuid | Sí | Proyecto al que pertenece |
| `title` | string | Sí | Título del caso |
| `description` | string nullable | No | Descripción del objetivo |
| `preconditions` | string nullable | No | Precondiciones |
| `steps` | json / text | Sí | Pasos del caso |
| `expectedResult` | string | Sí | Resultado esperado |
| `priority` | enum | Sí | Prioridad del caso |
| `status` | enum | Sí | Estado del caso |
| `createdBy` | string / uuid | Sí | Usuario creador |
| `createdAt` | datetime | Sí | Fecha de creación |
| `updatedAt` | datetime | Sí | Fecha de actualización |

### Enums sugeridos

#### `TestCasePriority`
- `LOW`
- `MEDIUM`
- `HIGH`

#### `TestCaseStatus`
- `DRAFT`
- `READY`
- `ARCHIVED`

---

## 9.3 Bug

### Propósito
Representar un defecto encontrado durante la validación del proyecto.

### Campos iniciales sugeridos

| Campo | Tipo sugerido | Obligatorio | Descripción |
|---|---|---:|---|
| `id` | string / uuid | Sí | Identificador único |
| `projectId` | string / uuid | Sí | Proyecto al que pertenece |
| `testCaseId` | string / uuid nullable | No | Caso de prueba relacionado |
| `title` | string | Sí | Título del bug |
| `description` | string | Sí | Descripción del defecto |
| `severity` | enum | Sí | Severidad |
| `status` | enum | Sí | Estado |
| `reportedBy` | string / uuid | Sí | Usuario que reporta |
| `assignedTo` | string / uuid nullable | No | Usuario asignado |
| `createdAt` | datetime | Sí | Fecha de creación |
| `updatedAt` | datetime | Sí | Fecha de actualización |

### Enums sugeridos

#### `BugSeverity`
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

#### `BugStatus`
- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`
- `CLOSED`

---

## 10. Modelo conceptual del módulo

```text
User
 └── Projects
      ├── Tasks
      ├── TestCases
      └── Bugs
```

### Vista ampliada del objeto Project

```text
Project
 ├── basicInfo
 │    ├── id
 │    ├── name
 │    ├── logoUrl
 │    ├── ownerId
 │    ├── status
 │    ├── createdAt
 │    └── updatedAt
 ├── tasks[]
 ├── testCases[]
 ├── bugs[]
 └── stats
      ├── totalTasks
      ├── totalTestCases
      ├── totalBugs
      ├── openBugs
      └── completedTasks
```

---

## 11. Alcance funcional de la fase inicial

### 11.1 Funcionalidades que sí deben implementarse

1. Crear proyecto.
2. Listar proyectos del usuario autenticado.
3. Consultar detalle de un proyecto.
4. Editar nombre y logo del proyecto.
5. Eliminar o archivar proyecto.
6. Mostrar resumen del proyecto.
7. Asociar tareas, casos de prueba y bugs al proyecto por `projectId`.
8. Mostrar contadores básicos.

### 11.2 Funcionalidades que no deben incluirse todavía

1. Miembros del proyecto.
2. Permisos avanzados por rol.
3. Comentarios.
4. Historial de actividad detallado.
5. Etiquetas complejas.
6. Automatizaciones.
7. Integraciones externas.
8. Tableros avanzados tipo kanban empresarial.
9. Reportes exportables.

El objetivo de esta fase es mantener un módulo simple, estable y escalable.

---

## 12. Historias de usuario iniciales del módulo

### HU-PROJ-01 Crear proyecto

- **Usuario:** QA / Usuario autenticado
- **Puntos estimados:** 5
- **Descripción:** Como usuario autenticado, quiero crear un proyecto para organizar tareas, casos de prueba y bugs relacionados.
- **Observaciones:** El dueño se asigna automáticamente.

**Criterios de aceptación**
- El usuario puede ingresar el nombre del proyecto.
- El usuario puede adjuntar un logo opcional.
- El sistema crea el proyecto con `ownerId` automático.
- El sistema registra fecha de creación.
- El sistema redirige al detalle o lista de proyectos al finalizar.

### HU-PROJ-02 Ver mis proyectos

- **Usuario:** QA / Usuario autenticado
- **Puntos estimados:** 3
- **Descripción:** Como usuario autenticado, quiero ver mis proyectos para ingresar al que deseo gestionar.

**Criterios de aceptación**
- El sistema muestra solo los proyectos del usuario autenticado.
- Cada proyecto muestra nombre, logo y métricas básicas.
- El usuario puede ingresar al detalle del proyecto.

### HU-PROJ-03 Editar proyecto

- **Usuario:** Dueño del proyecto
- **Puntos estimados:** 3
- **Descripción:** Como dueño del proyecto, quiero editar la información básica del proyecto para mantenerla actualizada.

**Criterios de aceptación**
- Solo el dueño puede editar.
- Se puede cambiar nombre.
- Se puede agregar o reemplazar logo.
- El sistema actualiza `updatedAt`.

### HU-PROJ-04 Eliminar o archivar proyecto

- **Usuario:** Dueño del proyecto
- **Puntos estimados:** 3
- **Descripción:** Como dueño, quiero eliminar o archivar un proyecto para mantener mi espacio organizado.

**Criterios de aceptación**
- Solo el dueño puede ejecutar la acción.
- El sistema solicita confirmación.
- La acción se refleja en la lista de proyectos.

### HU-PROJ-05 Ver resumen del proyecto

- **Usuario:** Dueño del proyecto
- **Puntos estimados:** 3
- **Descripción:** Como usuario, quiero ver métricas rápidas del proyecto para comprender su estado general.

**Criterios de aceptación**
- El sistema muestra cantidad de tareas.
- Muestra cantidad de casos de prueba.
- Muestra cantidad de bugs.
- Muestra bugs abiertos y tareas completadas si existen.

---

## 13. Requisitos funcionales del módulo

### RF-PROJ-01 Crear proyecto

**Caso de uso:** `CU-PROJ-01 "Crear proyecto"`

- **Actor:** Usuario autenticado
- **Descripción:** Permite crear un nuevo proyecto.
- **Precondición:** El usuario debe tener sesión válida.
- **Flujo principal:**
  1. El usuario accede a la vista de creación.
  2. Ingresa el nombre del proyecto.
  3. Opcionalmente adjunta un logo.
  4. El sistema valida datos.
  5. El backend toma el usuario autenticado y lo asigna como dueño.
  6. El sistema guarda el proyecto.
  7. El sistema responde con el proyecto creado.

### RF-PROJ-02 Listar proyectos del usuario

**Caso de uso:** `CU-PROJ-02 "Listar proyectos"`

- **Actor:** Usuario autenticado
- **Descripción:** Permite consultar los proyectos del usuario.
- **Precondición:** Usuario autenticado.
- **Flujo principal:**
  1. El usuario entra al módulo de proyectos.
  2. El frontend solicita los proyectos asociados al usuario actual.
  3. El backend devuelve la lista filtrada por dueño.
  4. El sistema muestra tarjetas o filas con información resumida.

### RF-PROJ-03 Consultar detalle del proyecto

**Caso de uso:** `CU-PROJ-03 "Ver detalle de proyecto"`

- **Actor:** Dueño del proyecto
- **Descripción:** Permite consultar la información detallada del proyecto.
- **Precondición:** Proyecto existente y acceso autorizado.
- **Flujo principal:**
  1. El usuario selecciona un proyecto.
  2. El sistema valida que tenga acceso.
  3. El backend devuelve información base y métricas.
  4. El frontend muestra la vista detalle con navegación interna.

### RF-PROJ-04 Editar proyecto

**Caso de uso:** `CU-PROJ-04 "Editar proyecto"`

- **Actor:** Dueño del proyecto
- **Descripción:** Permite modificar nombre y logo del proyecto.
- **Precondición:** Proyecto existente y pertenencia válida.
- **Flujo principal:**
  1. El usuario accede al formulario de edición.
  2. Modifica la información permitida.
  3. El sistema valida.
  4. El backend actualiza el proyecto.
  5. El sistema muestra la información actualizada.

### RF-PROJ-05 Eliminar o archivar proyecto

**Caso de uso:** `CU-PROJ-05 "Eliminar o archivar proyecto"`

- **Actor:** Dueño del proyecto
- **Descripción:** Permite retirar un proyecto de uso activo.
- **Precondición:** Proyecto existente y acceso válido.
- **Flujo principal:**
  1. El usuario selecciona eliminar o archivar.
  2. El sistema solicita confirmación.
  3. El backend valida permisos.
  4. El sistema ejecuta la acción.
  5. La lista se actualiza.

### RF-PROJ-06 Consultar resumen del proyecto

**Caso de uso:** `CU-PROJ-06 "Ver resumen del proyecto"`

- **Actor:** Dueño del proyecto
- **Descripción:** Permite visualizar métricas rápidas del proyecto.
- **Precondición:** Proyecto existente.
- **Flujo principal:**
  1. El usuario entra al detalle del proyecto.
  2. El frontend consulta el resumen.
  3. El backend calcula o agrega contadores.
  4. El frontend renderiza métricas.

---

## 14. Requisitos no funcionales del módulo

### Seguridad
- El acceso al módulo debe requerir autenticación.
- El `ownerId` no puede venir confiado desde cliente.
- El backend debe validar propiedad del recurso.
- Deben usarse DTOs y validación de entrada.

### Rendimiento
- La lista de proyectos debe responder rápidamente.
- El endpoint de resumen debe devolver solo agregados básicos y no cargar todos los hijos completos si no es necesario.

### Usabilidad
- La interfaz debe ser clara, simple y consistente con el frontend ya definido.
- El formulario de creación debe tener validaciones visibles.
- El usuario debe entender rápidamente cuál es el proyecto y su estado.

### Mantenibilidad
- El módulo debe implementarse desacoplado para que tareas, casos y bugs puedan crecer como submódulos independientes.
- Los enums deben centralizarse.
- La lógica de permisos debe estar separada de la lógica de persistencia.

### Escalabilidad
- La estructura debe permitir incorporar miembros, roles, actividad y dashboard sin rediseñar la tabla principal.
- Debe usarse `projectId` como pivote de relación entre módulos.

---

## 15. Navegación sugerida en frontend

Rutas iniciales recomendadas:

```text
/projects
/projects/new
/projects/:projectId
/projects/:projectId/tasks
/projects/:projectId/test-cases
/projects/:projectId/bugs
```

### Estructura recomendada de pantallas

#### 15.1 Vista de lista de proyectos
Mostrar:
- botón `Crear proyecto`
- cards o tabla con:
  - logo
  - nombre
  - fecha de creación
  - estado
  - número de tareas
  - número de casos de prueba
  - número de bugs

#### 15.2 Vista de creación de proyecto
Formulario simple con:
- Nombre del proyecto
- Carga de logo opcional
- Botón guardar
- Botón cancelar

#### 15.3 Vista de detalle de proyecto
Debe contener:
- Encabezado con logo y nombre
- Dueño
- Fecha de creación
- Estado
- Métricas rápidas
- Tabs internas:
  - Resumen
  - Tareas
  - Casos de prueba
  - Bugs

---

## 16. Reglas de UI para este módulo

El frontend del módulo debe respetar la guía visual de Qualio.

### 16.1 Principios de consistencia
- Reutilizar tokens de color existentes.
- Mantener tipografía `Manrope`.
- Mantener diseño mobile-first.
- Mantener estados visibles de foco y validación.

### 16.2 Recomendación visual para la lista de proyectos
- Card limpia con borde suave.
- Logo a la izquierda o arriba.
- Nombre del proyecto como elemento principal.
- Metadatos con tono secundario.
- Botón primario para crear nuevo proyecto.

### 16.3 Recomendación visual para el detalle de proyecto
- Cabecera con logo grande o avatar del proyecto.
- Bloque superior con métricas rápidas.
- Navegación por pestañas para separar submódulos.

---

## 17. Estructura recomendada del backend en NestJS

```text
apps/api/src/modules/projects/
  ├── projects.module.ts
  ├── projects.controller.ts
  ├── projects.service.ts
  ├── dto/
  │    ├── create-project.dto.ts
  │    ├── update-project.dto.ts
  │    └── project-summary.dto.ts
  ├── policies/
  │    └── project-ownership.policy.ts
  ├── entities/
  │    └── project.entity.ts
  └── mappers/
       └── project.mapper.ts
```

### Recomendación
Tareas, casos de prueba y bugs pueden ser módulos independientes, pero deben relacionarse siempre por `projectId`.

---

## 18. Endpoints iniciales sugeridos

### Proyectos

- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `DELETE /projects/:id`

### Resumen

- `GET /projects/:id/summary`

### Notas

- `GET /projects` debe devolver los proyectos del usuario autenticado o los que tenga permiso de ver.
- `POST /projects` debe ignorar cualquier `ownerId` enviado por cliente.
- `GET /projects/:id/summary` debe devolver agregados básicos.

---

## 19. DTOs sugeridos

### 19.1 `CreateProjectDto`

```ts
export class CreateProjectDto {
  name: string;
  logoUrl?: string;
}
```

### 19.2 `UpdateProjectDto`

```ts
export class UpdateProjectDto {
  name?: string;
  logoUrl?: string | null;
  status?: 'ACTIVE' | 'ARCHIVED';
}
```

### Regla importante
`ownerId` no pertenece al DTO de entrada.

---

## 20. Estructura de base de datos inicial

### 20.1 Tabla `projects`

| Campo | Tipo sugerido | Restricciones |
|---|---|---|
| `id` | uuid | PK |
| `name` | varchar | not null |
| `logo_url` | text | null |
| `owner_id` | uuid | not null, FK -> users.id |
| `status` | varchar / enum | not null |
| `created_at` | timestamptz | not null default now() |
| `updated_at` | timestamptz | not null |

### 20.2 Tabla `tasks`

| Campo | Tipo sugerido | Restricciones |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | not null, FK -> projects.id |
| `title` | varchar | not null |
| `description` | text | null |
| `status` | varchar / enum | not null |
| `priority` | varchar / enum | not null |
| `created_by` | uuid | not null |
| `assigned_to` | uuid | null |
| `due_date` | timestamptz | null |
| `created_at` | timestamptz | not null |
| `updated_at` | timestamptz | not null |

### 20.3 Tabla `test_cases`

| Campo | Tipo sugerido | Restricciones |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | not null, FK -> projects.id |
| `title` | varchar | not null |
| `description` | text | null |
| `preconditions` | text | null |
| `steps` | jsonb / text | not null |
| `expected_result` | text | not null |
| `priority` | varchar / enum | not null |
| `status` | varchar / enum | not null |
| `created_by` | uuid | not null |
| `created_at` | timestamptz | not null |
| `updated_at` | timestamptz | not null |

### 20.4 Tabla `bugs`

| Campo | Tipo sugerido | Restricciones |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | not null, FK -> projects.id |
| `test_case_id` | uuid | null, FK -> test_cases.id |
| `title` | varchar | not null |
| `description` | text | not null |
| `severity` | varchar / enum | not null |
| `status` | varchar / enum | not null |
| `reported_by` | uuid | not null |
| `assigned_to` | uuid | null |
| `created_at` | timestamptz | not null |
| `updated_at` | timestamptz | not null |

---

## 21. Política de eliminación recomendada

Para la fase inicial hay dos caminos posibles:

### Opción A: borrado lógico recomendado
- El proyecto no se elimina físicamente.
- Se cambia `status` a `ARCHIVED`.
- Se oculta en vistas principales o se separa en filtro.

### Opción B: borrado físico controlado
- Solo si aún no existen hijos relacionados.
- O eliminando en cascada con una política explícita.

### Recomendación
Para evitar pérdida de información, en la primera fase se recomienda **archivar** en vez de eliminar físicamente.

---

## 22. Resumen del proyecto para dashboard rápido

El módulo debe proveer una vista de resumen con datos agregados.

### Campos sugeridos en `ProjectSummary`

```json
{
  "projectId": "proj_001",
  "totalTasks": 8,
  "completedTasks": 3,
  "totalTestCases": 15,
  "totalBugs": 4,
  "openBugs": 2
}
```

### Finalidad
Evitar traer todas las colecciones completas cuando solo se requieren métricas.

---

## 23. Ejemplo de objeto Project

```json
{
  "id": "proj_001",
  "name": "Qualio MVP Testing",
  "logoUrl": "/uploads/projects/proj_001/logo.png",
  "ownerId": "usr_001",
  "status": "ACTIVE",
  "createdAt": "2026-03-15T10:00:00Z",
  "updatedAt": "2026-03-15T10:00:00Z",
  "stats": {
    "totalTasks": 8,
    "completedTasks": 3,
    "totalTestCases": 15,
    "totalBugs": 4,
    "openBugs": 2
  }
}
```

---

## 24. Reglas de autorización recomendadas

### Acciones permitidas para el dueño
- Ver proyecto
- Editar proyecto
- Archivar proyecto
- Crear tareas
- Crear casos de prueba
- Crear bugs

### Acciones denegadas a usuarios sin acceso
- Consultar detalle de proyecto ajeno
- Editar proyecto ajeno
- Eliminar o archivar proyecto ajeno
- Crear elementos en proyecto ajeno

### Validación mínima en backend
Antes de devolver o modificar un proyecto, el backend debe validar que:

- el proyecto exista
- el usuario tenga permiso
- la entrada sea válida

---

## 25. Orden recomendado de construcción para OpenCode

### Fase 1
1. Modelo `Project` en Prisma.
2. Migración SQL / Prisma.
3. CRUD básico de proyectos en backend.
4. Guard de autenticación y validación de ownership.
5. Vista frontend de lista de proyectos.
6. Vista frontend de creación.
7. Vista frontend de detalle.
8. Endpoint de resumen.

### Fase 2
1. Integración de `Task`.
2. Integración de `TestCase`.
3. Integración de `Bug`.
4. Contadores reales por proyecto.

### Fase 3
1. Dashboard del proyecto.
2. Miembros.
3. Permisos avanzados.
4. Actividad y auditoría.

---

## 26. Criterios de aceptación técnicos para considerar listo el módulo

El módulo de proyectos se considerará funcionalmente listo en su fase inicial cuando:

1. Un usuario autenticado pueda crear un proyecto.
2. El dueño se asigne automáticamente desde sesión.
3. La lista de proyectos muestre correctamente los proyectos del usuario.
4. Se pueda consultar el detalle de un proyecto.
5. Se pueda editar nombre y logo.
6. Se pueda archivar el proyecto.
7. Exista un endpoint de resumen con contadores básicos.
8. Todas las operaciones validen acceso y pertenencia.
9. La interfaz respete la guía visual definida para Qualio.

---

## 27. Instrucciones concretas para el agente OpenCode

### Construir primero
- entidad `Project`
- CRUD de proyectos
- summary endpoint
- pantallas `/projects`, `/projects/new`, `/projects/:projectId`

### No construir aún
- roles avanzados
- colaboración multiusuario
- comentarios
- automatizaciones
- integraciones con terceros

### Decisiones técnicas obligatorias
- usar el usuario autenticado como fuente del `ownerId`
- separar permisos en una capa clara
- relacionar submódulos por `projectId`
- mantener la estructura preparada para crecimiento

---

## 28. Conclusión

El módulo de proyectos debe ser construido como la **base estructural de Qualio**.  
No debe entenderse solo como una tabla o formulario, sino como el contenedor principal desde el cual se organizan tareas, casos de prueba, bugs y futuras métricas.

La implementación inicial debe centrarse en simplicidad, control de ownership, claridad visual y escalabilidad.  
Si esta base queda bien construida, el resto de módulos podrá crecer de forma ordenada alrededor de `Project` como entidad raíz.
