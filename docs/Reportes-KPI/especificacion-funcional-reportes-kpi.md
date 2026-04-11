# Reportes KPI - Especificacion funcional y ruta de implementacion

## 1. Objetivo

Habilitar un modulo de reportes en la vista `Proyecto > Reportes` con tres modos:

- `General`
- `Por Sprint`
- `Mensual QA`

El objetivo es mostrar KPI accionables, tendencias y tablas resumen, ademas de exportacion CSV por filtro.

## 2. Alcance MVP

Incluido en MVP:

- Vistas `General`, `Sprint` y `Mensual`.
- Filtros por vista.
- KPI cards.
- Graficas (linea, barras, donut).
- Tabla resumen.
- Exportacion CSV.

Fuera de MVP (fase posterior):

- Exportacion PDF.
- Dashboards cross-proyecto.
- Programacion automatica de reportes por correo.

## 3. Reglas de negocio cerradas

- Ticket completado:
  - Task: `DONE`
  - Bug: `RESOLVED` o `CLOSED`
- Ticket abierto:
  - Task: `TODO`, `IN_PROGRESS`
  - Bug: `OPEN`, `IN_PROGRESS`
- Reabierto:
  - Ticket que paso de estado completado a estado abierto.
- Zona horaria de calculo backend: `UTC`.
- Formato de fecha en frontend: local del navegador.

## 4. UX objetivo

### 4.1 Toolbar de filtros

- Segmented control: `General | Sprint | Mensual`.
- Selector de sprint (solo en modo Sprint).
- Selector de mes `YYYY-MM` (solo en modo Mensual).
- Boton `Exportar CSV`.

### 4.2 Layout de pantalla

- Fila 1: 4 KPI cards.
- Fila 2: 2 graficas principales.
- Fila 3: tabla resumen.
- Empty state claro cuando no hay datos para el filtro.

## 5. KPI por vista

### 5.1 General

- Total tickets.
- Tickets completados.
- Tasa de completado (%).
- Bugs abiertos.
- Tickets reabiertos.
- Tickets rollover.

### 5.2 Sprint

- Comprometidos al inicio del sprint.
- Completados en sprint.
- Cumplimiento sprint (%).
- Rollover al siguiente sprint.
- Reabiertos en sprint.

### 5.3 Mensual QA

- Tickets creados en el mes.
- Tickets cerrados en el mes.
- Lead time promedio (dias) de cierre.
- Reopen rate (%).

## 6. Graficas por vista

### 6.1 General

- Linea: creados vs cerrados por semana (ultimas N semanas).
- Donut: distribucion por prioridad.

### 6.2 Sprint

- Burndown simple: pendientes por dia.
- Barras: completados vs rollover.

### 6.3 Mensual

- Linea: creados vs cerrados por semana del mes.
- Barras: tasks cerradas vs bugs cerrados por semana.

## 7. Contratos API propuestos

### 7.1 General

Endpoint:

`GET /projects/:projectId/reports/overview?weeks=8`

Respuesta ejemplo:

```json
{
  "kpis": {
    "totalTickets": 120,
    "completedTickets": 84,
    "completionRate": 70,
    "openBugs": 9,
    "reopenedTickets": 7,
    "rolloverTickets": 5
  },
  "trend": [
    { "bucket": "2026-W05", "created": 14, "closed": 10 },
    { "bucket": "2026-W06", "created": 11, "closed": 13 }
  ],
  "priorityDistribution": [
    { "priority": "HIGH", "count": 22 },
    { "priority": "MEDIUM", "count": 68 },
    { "priority": "LOW", "count": 30 }
  ],
  "summaryTable": [
    { "type": "TASK", "open": 12, "inProgress": 15, "completed": 50 },
    { "type": "BUG", "open": 9, "inProgress": 0, "completed": 34 }
  ]
}
```

### 7.2 Sprint

Endpoint:

`GET /projects/:projectId/reports/sprints/:sprintId`

Respuesta ejemplo:

```json
{
  "sprint": {
    "id": "...",
    "name": "Sprint 4",
    "sequence": 4,
    "startedAt": "2026-03-01T00:00:00.000Z",
    "closedAt": null
  },
  "kpis": {
    "committedAtStart": 34,
    "completedInSprint": 21,
    "completionRate": 61.8,
    "rolloverToNext": 8,
    "reopenedInSprint": 3
  },
  "burndown": [
    { "date": "2026-03-01", "remaining": 34 },
    { "date": "2026-03-02", "remaining": 31 }
  ],
  "delivery": [
    { "bucket": "week-1", "completedTasks": 8, "completedBugs": 3, "rollover": 2 }
  ]
}
```

### 7.3 Mensual

Endpoint:

`GET /projects/:projectId/reports/monthly?month=2026-03`

Respuesta ejemplo:

```json
{
  "month": "2026-03",
  "kpis": {
    "created": 42,
    "closed": 35,
    "avgLeadTimeDays": 4.7,
    "reopenRate": 8.3
  },
  "weeklyTrend": [
    { "week": "W1", "created": 10, "closed": 8 },
    { "week": "W2", "created": 12, "closed": 11 }
  ],
  "weeklyTypeClosure": [
    { "week": "W1", "tasksClosed": 6, "bugsClosed": 2 }
  ]
}
```

### 7.4 Exportacion CSV

Endpoints:

- `GET /projects/:projectId/reports/overview.csv?weeks=8`
- `GET /projects/:projectId/reports/sprints/:sprintId.csv`
- `GET /projects/:projectId/reports/monthly.csv?month=YYYY-MM`

## 8. Modelo de datos (fuentes)

Tablas base usadas para calculo:

- `tasks`
- `bugs`
- `sprints`
- `work_item_history` (para reabiertos y eventos historicos)

## 9. Ruta de implementacion recomendada

### Fase 1 - Backend General

1. Crear modulo `reports` en API.
2. Implementar endpoint `overview`.
3. Validar ownership por proyecto.
4. Agregar pruebas unitarias de agregacion.

### Fase 2 - Frontend General

1. Crear clientes en `apps/web/src/lib/reports.ts`.
2. Render toolbar + KPI cards + 2 graficas + tabla.
3. Empty state y manejo de error.

### Fase 3 - Sprint

1. Endpoint `reports/sprints/:sprintId`.
2. Burndown y KPI de cumplimiento.
3. Integracion UI con selector de sprint.

### Fase 4 - Mensual QA

1. Endpoint `reports/monthly`.
2. KPI QA mensual + tendencias semanales.
3. Integracion UI con selector mes.

### Fase 5 - Export CSV

1. Endpoints CSV para cada vista.
2. Boton export en toolbar.
3. Validacion de columnas y formato.

## 10. Criterios de aceptacion

- Cambiar vista/filtros actualiza KPI, graficas y tabla sin recargar pagina.
- Los valores de KPI son consistentes con datos de tareas/bugs/sprints.
- Export CSV respeta el mismo filtro visible en pantalla.
- Empty state y errores de API son comprensibles.

## 11. Riesgos y mitigaciones

- Riesgo: datos historicos incompletos para KPI de tiempo.
  - Mitigacion: fallback de KPI con `N/A` y registro en log tecnico.
- Riesgo: consultas pesadas en proyectos grandes.
  - Mitigacion: indices por fecha/proyecto/estado y agregaciones por lotes.
- Riesgo: interpretacion distinta de estados completados.
  - Mitigacion: mantener reglas cerradas del punto 3.

## 12. Evolucion posterior (no MVP)

- Export PDF con plantilla ejecutiva.
- Reportes cross-proyecto para direccion.
- Alertas automaticas por umbral KPI (ej. reopen rate alto).
- Programacion mensual por correo (snapshot KPI).
