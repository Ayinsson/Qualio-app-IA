# Portada

| Campo | Detalle |
|---|---|
| Institucion | Inserte nombre de la institucion |
| Programa | Inserte nombre del programa |
| Asignatura | Inserte nombre de la asignatura |
| Titulo del documento | Documento tecnico de validacion de requisitos, prototipos y casos de prueba |
| Proyecto | Qualio - Gestion de proyectos, backlog, sprint y reportes |
| Elaborado por | Inserte nombre del estudiante o equipo |
| Instructor | Inserte nombre del instructor |
| Ciudad y fecha | Inserte ciudad - 26-03-2026 |

---

# Tabla de contenido

1. Control de versiones del documento  
2. Introduccion  
3. Alcance  
4. Tecnicas de validacion aplicadas  
5. Lista de requerimientos (historias de usuario)  
6. HU-01 - Crear proyecto  
7. HU-05 - Iniciar sprint  
8. HU-07 - Gestionar invitaciones de participantes  
9. HU-09 - Consultar reportes del proyecto  
10. Criterios de aprobacion del documento  
11. Aprobacion  
12. Anexos  

---

# Documento tecnico de validacion de requisitos

## 1. Control de versiones del documento

| Version | Fecha | Autor | Descripcion del cambio |
|---|---|---|---|
| 1.0 | 26-03-2026 | Equipo Qualio | Creacion inicial del documento con 4 HU, prototipos y casos de prueba |

## 2. Introduccion

Este documento presenta la validacion funcional de requisitos para el sistema Qualio, usando tecnicas de prototipado y casos de prueba por interfaz. El objetivo es verificar que las necesidades del usuario se representen de forma clara antes o durante el desarrollo, y que cada interfaz tenga un criterio objetivo de validacion.

La validacion se enfoca en cuatro historias de usuario priorizadas del proyecto:

- HU-01: Crear proyecto.
- HU-05: Iniciar sprint desde backlog.
- HU-07: Gestionar invitaciones de participantes.
- HU-09: Consultar reportes del proyecto.

## 3. Alcance

Este documento cubre:

- Definicion de 4 historias de usuario.
- Prototipo por cada interfaz asociada (espacio reservado para mockups).
- Caso de prueba por cada interfaz, con objetivo, identificador, precondiciones y pasos con resultados esperados.

Este documento no cubre:

- Pruebas no funcionales (carga, seguridad, rendimiento).
- Plan de despliegue a produccion.
- Trazabilidad completa con todos los requisitos del producto.

## 4. Tecnicas de validacion aplicadas

| Tecnica | Aplicacion en este documento | Evidencia esperada |
|---|---|---|
| Revision de requisitos | Validacion de claridad, consistencia y completitud de HU | HU redactadas y estructuradas |
| Prototipado de interfaz | Representacion visual de cada HU en pantalla | Mockup insertado por interfaz |
| Caso de prueba funcional | Verificacion paso a paso del comportamiento esperado | Tabla de pasos y resultados esperados |

## 5. Lista de requerimientos (historias de usuario)

| ID | Historia de usuario | Prioridad | Interfaz principal |
|---|---|---|---|
| HU-01 | Como owner, quiero crear un proyecto con nombre, tipo y descripcion para organizar el trabajo del equipo. | Alta | Modal/Formulario de creacion de proyecto |
| HU-05 | Como owner, quiero iniciar un sprint para mover automaticamente los tickets de Proximo Sprint al tablero. | Alta | Vista Backlog (boton Iniciar Sprint) |
| HU-07 | Como owner, quiero invitar usuarios existentes y cancelar invitaciones pendientes para controlar acceso al proyecto. | Alta | Modal de Participantes + seccion Invitaciones pendientes |
| HU-09 | Como owner, quiero consultar reportes (General, Sprint, Mensual QA) para evaluar KPIs del proyecto. | Alta | Vista Reportes del proyecto |

---

## 6. HU-01 - Crear proyecto

### 6.1 Prototipo de interfaz

**Inserte imagen aqui del modulo Crear Proyecto (modal/formulario)**

### 6.2 Caso de prueba asociado

| Campo | Valor |
|---|---|
| Identificador | CP-HU01-01 |
| Nombre | Creacion de proyecto con datos validos |
| Objetivo | Validar que un owner pueda crear un proyecto y visualizarlo en la lista de proyectos activos |
| HU asociada | HU-01 - Crear proyecto |
| Precondiciones | 1) Usuario autenticado como owner. 2) Acceso a la vista principal de proyectos. |

| Paso | Accion | Resultado esperado |
|---|---|---|
| 1 | Abrir modal de creacion de proyecto | Se muestra formulario con campos requeridos |
| 2 | Ingresar nombre, tipo y descripcion validos | El formulario acepta los datos sin error |
| 3 | Guardar proyecto | Se crea registro y se cierra modal |
| 4 | Revisar lista de proyectos activos | El nuevo proyecto aparece con estado Activo |

---

## 7. HU-05 - Iniciar sprint

### 7.1 Prototipo de interfaz

**Inserte imagen aqui del modulo Backlog con boton Iniciar Sprint**

### 7.2 Caso de prueba asociado

| Campo | Valor |
|---|---|
| Identificador | CP-HU05-01 |
| Nombre | Inicio de sprint con tickets en Proximo Sprint |
| Objetivo | Validar que al iniciar sprint se cree Sprint N y se muevan tickets desde Proximo Sprint al Tablero |
| HU asociada | HU-05 - Iniciar sprint |
| Precondiciones | 1) Usuario owner autenticado. 2) Proyecto existente. 3) Minimo 1 ticket en seccion Proximo Sprint. |

| Paso | Accion | Resultado esperado |
|---|---|---|
| 1 | Ir a vista Backlog del proyecto | Se visualizan secciones Proximo Sprint y Backlog General |
| 2 | Verificar tickets en Proximo Sprint | Existen uno o mas tickets listados |
| 3 | Clic en Iniciar Sprint | Se crea el siguiente sprint con nomenclatura sucesiva |
| 4 | Ir a vista Tablero | Los tickets de Proximo Sprint ahora aparecen en Tablero |
| 5 | Revisar mensaje de confirmacion | Se muestra feedback de sprint iniciado correctamente |

---

## 8. HU-07 - Gestionar invitaciones de participantes

### 8.1 Prototipo de interfaz

**Inserte imagen aqui del modulo Participantes con pestaña Invitaciones pendientes**

### 8.2 Caso de prueba asociado

| Campo | Valor |
|---|---|
| Identificador | CP-HU07-01 |
| Nombre | Invitacion y cancelacion de invitacion pendiente |
| Objetivo | Validar que el owner pueda invitar usuario existente y cancelar invitacion pendiente desde Participantes |
| HU asociada | HU-07 - Gestionar invitaciones de participantes |
| Precondiciones | 1) Usuario owner autenticado. 2) Proyecto existente. 3) Correo de usuario existente en plataforma. |

| Paso | Accion | Resultado esperado |
|---|---|---|
| 1 | Abrir modal Participantes | Se visualizan pestañas Participantes e Invitaciones pendientes |
| 2 | Enviar invitacion a correo existente | Invitacion creada exitosamente |
| 3 | Ir a pestaña Invitaciones pendientes | Se muestra la nueva invitacion con estado PENDING |
| 4 | Clic en Cancelar sobre la invitacion | Invitacion se elimina del listado pendiente |
| 5 | Validar panel de notificaciones del invitado | Notificacion de invitacion ya no aparece |

---

## 9. HU-09 - Consultar reportes del proyecto

### 9.1 Prototipo de interfaz

**Inserte imagen aqui del modulo Reportes (vistas General, Sprint y Mensual QA)**

### 9.2 Caso de prueba asociado

| Campo | Valor |
|---|---|
| Identificador | CP-HU09-01 |
| Nombre | Consulta de KPI y graficas por vista de reportes |
| Objetivo | Validar que el owner pueda consultar KPI y graficas en modos General, Sprint y Mensual QA |
| HU asociada | HU-09 - Consultar reportes del proyecto |
| Precondiciones | 1) Usuario owner autenticado. 2) Proyecto con datos de tareas, bugs y sprints. |

| Paso | Accion | Resultado esperado |
|---|---|---|
| 1 | Abrir pestaña Reportes del proyecto | Se muestra toolbar de vistas y panel de resultados |
| 2 | Seleccionar vista General | Se muestran KPI generales, tendencia y resumen por tipo |
| 3 | Seleccionar vista Sprint y elegir un sprint | Se muestran KPI de sprint y burndown |
| 4 | Seleccionar vista Mensual QA y elegir mes | Se muestran KPI mensuales y tendencias semanales |
| 5 | Exportar CSV/PDF de la vista actual | Se descarga archivo correspondiente al filtro aplicado |

---

## 10. Criterios de aprobacion del documento

| Criterio | Regla de aprobacion |
|---|---|
| Estructura minima | Incluye introduccion, alcance, lista de requerimientos y version |
| Cobertura HU | Incluye exactamente 4 HU definidas y trazables |
| Cobertura de prototipos | Incluye espacio de mockup por interfaz |
| Cobertura de pruebas | Incluye 1 caso de prueba por interfaz con pasos y resultados esperados |

## 11. Aprobacion

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Responsable funcional |  |  |  |
| Lider tecnico |  |  |  |
| Instructor/Revisor |  |  |  |

## 12. Anexos

| Anexo | Descripcion | Evidencia |
|---|---|---|
| A1 | Mockup interfaz HU-01 | Inserte imagen aqui del mockup HU-01 |
| A2 | Mockup interfaz HU-05 | Inserte imagen aqui del mockup HU-05 |
| A3 | Mockup interfaz HU-07 | Inserte imagen aqui del mockup HU-07 |
| A4 | Mockup interfaz HU-09 | Inserte imagen aqui del mockup HU-09 |
