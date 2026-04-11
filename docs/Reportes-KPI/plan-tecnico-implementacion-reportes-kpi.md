# Reportes KPI - Plan tecnico de implementacion (tickets)

## 1. Objetivo del plan

Desglosar la implementacion de `Proyecto > Reportes` en tickets ejecutables para backend, frontend y QA, alineados con la especificacion funcional.

Referencia funcional:

- `docs/Reportes-KPI/especificacion-funcional-reportes-kpi.md`

## 2. Secuencia recomendada

1. Backend `overview`
2. Frontend `overview`
3. Backend + frontend `sprint`
4. Backend + frontend `mensual`
5. Export CSV
6. QA + hardening

## 3. Backlog tecnico (tickets)

## 3.1 Infra base reportes

### RPT-001 - Crear modulo reports en API

- Tipo: Backend
- Prioridad: Alta
- Descripcion:
  - Crear `apps/api/src/modules/reports/` con:
    - `reports.module.ts`
    - `reports.controller.ts`
    - `reports.service.ts`
  - Registrar modulo en `apps/api/src/app.module.ts`.
- DoD:
  - Endpoint base responde `200` con estructura vacia valida.

### RPT-002 - Definir DTOs y contratos de respuesta

- Tipo: Backend
- Prioridad: Alta
- Descripcion:
  - Crear DTOs para:
    - `OverviewReportDto`
    - `SprintReportDto`
    - `MonthlyReportDto`
  - Tipar tablas de salida (trend/distribution/summary).
- DoD:
  - Contratos alineados con especificacion funcional.

### RPT-003 - Guard de ownership por proyecto

- Tipo: Backend
- Prioridad: Alta
- Descripcion:
  - Reusar validacion de owner para reportes por proyecto.
- DoD:
  - Usuario no owner recibe `403`.

## 3.2 Vista General

### RPT-010 - Endpoint overview

- Tipo: Backend
- Prioridad: Alta
- Endpoint: `GET /projects/:projectId/reports/overview?weeks=8`
- Descripcion:
  - Calcular KPI:
    - `totalTickets`
    - `completedTickets`
    - `completionRate`
    - `openBugs`
    - `reopenedTickets`
    - `rolloverTickets`
  - Calcular `trend` semanal (creados vs cerrados).
  - Calcular `priorityDistribution`.
  - Calcular `summaryTable` por tipo.
- DoD:
  - Respuesta completa y consistente.

### RPT-011 - Cliente web overview

- Tipo: Frontend
- Prioridad: Alta
- Descripcion:
  - Crear `apps/web/src/lib/reports.ts` con `getOverviewReport`.
  - Integrar query en tab `Reportes`.
- DoD:
  - Datos visibles con estados loading/error/empty.

### RPT-012 - UI overview (cards + graficas + tabla)

- Tipo: Frontend
- Prioridad: Alta
- Descripcion:
  - Agregar libreria de graficas (recomendado `recharts`).
  - Renderizar:
    - 4 KPI cards.
    - 2 graficas (`trend` y `priorityDistribution`).
    - Tabla resumen.
- DoD:
  - UX responsive desktop/mobile.

## 3.3 Vista Sprint

### RPT-020 - Endpoint sprint report

- Tipo: Backend
- Prioridad: Alta
- Endpoint: `GET /projects/:projectId/reports/sprints/:sprintId`
- Descripcion:
  - KPI sprint:
    - `committedAtStart`
    - `completedInSprint`
    - `completionRate`
    - `rolloverToNext`
    - `reopenedInSprint`
  - Serie `burndown` por dia.
  - Serie `delivery` por semana.
- DoD:
  - Cubre sprint activo y sprint cerrado.

### RPT-021 - Selector sprint en UI reportes

- Tipo: Frontend
- Prioridad: Alta
- Descripcion:
  - Agregar filtro por sprint en toolbar de reportes.
  - Consumir endpoint sprint y renderizar cards + graficas.
- DoD:
  - Cambiar sprint refresca todo el panel.

## 3.4 Vista Mensual QA

### RPT-030 - Endpoint monthly report

- Tipo: Backend
- Prioridad: Alta
- Endpoint: `GET /projects/:projectId/reports/monthly?month=YYYY-MM`
- Descripcion:
  - KPI mensual:
    - `created`
    - `closed`
    - `avgLeadTimeDays`
    - `reopenRate`
  - `weeklyTrend`.
  - `weeklyTypeClosure`.
- DoD:
  - Month parser robusto, validacion de formato.

### RPT-031 - Selector mensual en UI reportes

- Tipo: Frontend
- Prioridad: Media
- Descripcion:
  - Input/select de mes.
  - Render de KPI QA mensual y graficas.
- DoD:
  - Cambio de mes refresca panel sin recargar.

## 3.5 Export CSV

### RPT-040 - CSV overview

- Tipo: Backend
- Prioridad: Media
- Endpoint: `GET /projects/:projectId/reports/overview.csv?weeks=8`
- DoD:
  - Descarga archivo CSV con encabezados claros.

### RPT-041 - CSV sprint

- Tipo: Backend
- Prioridad: Media
- Endpoint: `GET /projects/:projectId/reports/sprints/:sprintId.csv`

### RPT-042 - CSV monthly

- Tipo: Backend
- Prioridad: Media
- Endpoint: `GET /projects/:projectId/reports/monthly.csv?month=YYYY-MM`

### RPT-043 - Boton exportar en frontend

- Tipo: Frontend
- Prioridad: Media
- Descripcion:
  - Boton unico `Exportar CSV` que usa endpoint segun vista activa.
- DoD:
  - Descarga correcta en General/Sprint/Mensual.

## 3.6 QA y hardening

### RPT-050 - Pruebas backend (unitarias)

- Tipo: QA/Backend
- Prioridad: Alta
- Descripcion:
  - Casos:
    - proyecto sin datos
    - proyecto con tasks/bugs mixtos
    - sprints cerrados y activos
    - ticket reabierto
  - Verificar formulas de KPI.

### RPT-051 - Pruebas frontend (render + filtros)

- Tipo: QA/Frontend
- Prioridad: Alta
- Descripcion:
  - Validar render de cards/graficas/tabla.
  - Validar toolbar por vista.
  - Validar empty/error states.

### RPT-052 - Performance SQL

- Tipo: Backend
- Prioridad: Media
- Descripcion:
  - Revisar planes de consulta.
  - Agregar indices faltantes por `project_id`, `status`, `created_at`, `updated_at`, `sprint_id`.

## 4. Tareas tecnicas por capa

## 4.1 Backend

- Crear modulo reports.
- Escribir queries agregadas SQL (evitar n+1).
- Exponer endpoints JSON + CSV.
- Manejar validacion de parametros (`weeks`, `month`, `sprintId`).

## 4.2 Frontend

- Crear cliente `lib/reports.ts`.
- Reemplazar placeholder actual de tab reportes.
- Construir layout de reportes con componentes reutilizables:
  - `ReportToolbar`
  - `KpiCards`
  - `ReportChartPanel`
  - `ReportSummaryTable`

## 4.3 QA

- Matriz de casos funcionales por vista.
- Verificacion de formulas KPI con dataset controlado.
- Pruebas cross-browser en export CSV.

## 5. Criterios de aceptacion global

- Todas las vistas de reportes responden con data real.
- KPI y graficas cambian segun filtros.
- CSV exporta exactamente lo que se visualiza por filtro.
- El modulo funciona en desktop y mobile.

## 6. Riesgos y decisiones tecnicas

- Riesgo: consultas pesadas en tablas grandes.
  - Decision: agregar indices y limitar rango por defecto (`weeks=8`).
- Riesgo: inconsistencias por timezone.
  - Decision: agregaciones UTC en backend.
- Riesgo: KPI ambiguo por estado de bug.
  - Decision: completado bug = `RESOLVED` + `CLOSED`.

## 7. Plan de entregas (iteraciones)

- Iteracion 1:
  - RPT-001, RPT-002, RPT-003, RPT-010, RPT-011, RPT-012
- Iteracion 2:
  - RPT-020, RPT-021, RPT-030, RPT-031
- Iteracion 3:
  - RPT-040, RPT-041, RPT-042, RPT-043, RPT-050, RPT-051, RPT-052
