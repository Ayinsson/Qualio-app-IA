# Planning por proyecto

Plan opcional por proyecto: **Etapa → Macroactividad → Ticket**. El avance sale solo de los tickets.

## Reglas
- **Avance:** % de tickets de primer nivel terminados (tarea DONE; bug RESOLVED/CLOSED). Un ticket con subtareas suma la fracción de subtareas cerradas.
- **Esperado:** días hábiles (lunes a viernes, sin feriados) transcurridos / días hábiles de la etapa.
- **Estados:** Sin iniciar, En tiempo, En riesgo (real < esperado − 15), Atrasada (pasó el fin sin 100%), Completada, Sin tickets.
- **Proyección:** ritmo = terminados / días hábiles transcurridos. El mayor desfase de una etapa en riesgo o atrasada empuja el fin del proyecto.
- **Línea base:** comprometido = asignado hasta el inicio de la etapa o el día en que se creó (lo más tarde); lo posterior es "alcance agregado".
- **Subtareas** (tareas o bugs): un nivel, heredan la etapa del padre, no suman alcance e impiden cerrar el padre mientras estén abiertas (web, REST y MCP).
- Borrar una etapa o macroactividad no borra tickets: quedan "sin planificar".

## API
- `GET /projects/:id/planning` (`projects:read`)
- `POST /projects/:id/stages`, `PATCH|DELETE /stages/:id` (`projects:write`; `PATCH` acepta `move: up|down`)
- `POST /stages/:id/groups`, `PATCH|DELETE /stage-groups/:id` (`projects:write`)
- Tareas y bugs aceptan `startDate`, `stageGroupId`, `parentType` + `parentId`.

Código: `apps/api/src/modules/planning/` y `apps/web/src/features/project/planning/`. SQL en `00_bootstrap_schema.sql` (idempotente). Zona horaria: `PLANNING_TIMEZONE` (por defecto `America/Bogota`).

## Pendiente (fases siguientes)
Cronograma tipo Gantt, herramienta MCP `get_planning`, plantilla CSV/Excel, feriados y acceso de miembros del equipo.
