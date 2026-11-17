# Introduccion

Este documento define el set de pruebas funcionales manuales del frontend de Qualio para los modulos del MVP:

- Creacion de proyectos.
- Creacion de tareas y bugs.
- Inicio de sprint desde backlog.
- Autenticacion y perfil de usuario.
- Edicion y archivado de proyectos.
- Participantes e invitaciones.
- Adjuntos e historial de items.
- Notificaciones.
- Reportes KPI.

El objetivo es validar que las interfaces permitan ejecutar el flujo esperado de negocio de forma clara, consistente y sin errores bloqueantes en entorno web.

## Alcance

Las pruebas incluidas en este set cubren unicamente ejecucion manual desde interfaz de usuario (frontend).

Incluye:

- Formularios, validaciones y mensajes de confirmacion.
- Comportamientos visibles en Backlog y Tablero al crear tickets e iniciar sprint.
- Restricciones funcionales asociadas al flujo de sprint.

No incluye:

- Pruebas de carga o rendimiento.
- Pruebas de seguridad.
- Pruebas automatizadas de API.

## Matriz de pruebas funcionales (manuales)

| ID | Modulo | Descripcion de la prueba | Resultado esperado |
|---|---|---|---|
| PF-001 | Creacion de proyecto | Crear proyecto con nombre, tipo y descripcion validos | El proyecto se crea y aparece en la lista de proyectos activos |
| PF-002 | Creacion de proyecto | Intentar crear proyecto sin nombre | El sistema bloquea guardado y muestra validacion del campo obligatorio |
| PF-003 | Creacion de proyecto | Crear proyecto y abrir su detalle desde la lista | Se visualiza correctamente la vista de proyecto con tabs y acciones |
| PF-004 | Creacion de tareas/bugs | Crear tarea con titulo, prioridad y descripcion validos | La tarea se registra y aparece en Backlog General |
| PF-005 | Creacion de tareas/bugs | Crear bug con titulo, prioridad, entorno y resultados | El bug se registra y aparece en Backlog General |
| PF-006 | Creacion de tareas/bugs | Crear ticket cuando hay sprint activo y aceptar agregar al sprint actual | El ticket se crea en Tablero del sprint activo |
| PF-007 | Creacion de tareas/bugs | Crear ticket cuando hay sprint activo y elegir backlog general | El ticket se crea en Backlog General |
| PF-008 | Inicio de sprint | Iniciar sprint con tickets en Proximo Sprint | Se crea sprint sucesivo y tickets pasan a Tablero |
| PF-009 | Inicio de sprint | Intentar iniciar sprint sin tickets en Proximo Sprint | El sistema bloquea accion y muestra mensaje de validacion |
| PF-010 | Inicio de sprint | Iniciar nuevo sprint con tickets no finalizados en tablero | Los no finalizados pasan al nuevo sprint con etiqueta RollOver-Sprint X |
| PF-011 | Autenticacion | Registrarse con correo nuevo y contrasena valida | La cuenta se crea y el usuario entra al panel principal |
| PF-012 | Autenticacion | Iniciar sesion con contrasena incorrecta | El sistema niega el acceso y muestra mensaje de error |
| PF-013 | Perfil de usuario | Cambiar contrasena ingresando una contrasena actual incorrecta | El sistema rechaza el cambio y muestra validacion |
| PF-014 | Perfil de usuario | Cargar una imagen como avatar | El avatar se guarda y se muestra en el encabezado |
| PF-015 | Edicion de proyecto | Editar el nombre y el logo del proyecto como owner | Los cambios se guardan y se reflejan en la lista y el detalle |
| PF-016 | Edicion de proyecto | Archivar un proyecto como owner | El proyecto sale de la lista de proyectos activos |
| PF-017 | Participantes e invitaciones | Invitar a un correo registrado en la plataforma | La invitacion queda pendiente y el invitado recibe la notificacion |
| PF-018 | Participantes e invitaciones | Invitar a un correo no registrado | El sistema rechaza la invitacion con un mensaje claro |
| PF-019 | Participantes e invitaciones | Aceptar una invitacion desde el panel de notificaciones | El usuario pasa a ser miembro y ve el proyecto en su lista |
| PF-020 | Adjuntos e historial | Adjuntar una imagen a una tarea | El adjunto se lista en el detalle con previsualizacion |
| PF-021 | Adjuntos e historial | Cambiar la prioridad de un bug y abrir su historial | El historial muestra el campo, el valor anterior, el nuevo y la fecha |
| PF-022 | Notificaciones | Filtrar el panel de notificaciones por categoria | La lista y los contadores se actualizan segun el filtro |
| PF-023 | Reportes KPI | Abrir la vista General de Reportes en un proyecto con datos | Se muestran KPI, tendencia y tabla resumen |
| PF-024 | Reportes KPI | Seleccionar la vista Sprint y elegir un sprint | Se muestran KPI del sprint y burndown |
| PF-025 | Reportes KPI | Exportar CSV de la vista activa | Se descarga el archivo CSV con los datos del filtro aplicado |

## Notas de ejecucion

> **Importante:** Ejecutar pruebas con usuario owner para validar acciones de creacion de proyecto e inicio de sprint. Para PF-017 a PF-019 se requiere un segundo usuario registrado que actue como invitado.

> **Importante:** Registrar evidencia visual por cada caso (captura de pantalla antes y despues) para soportar resultados de validacion.
