# Introduccion

Este documento define el set de pruebas funcionales manuales del frontend de Qualio para tres modulos clave:

- Creacion de proyectos.
- Creacion de tareas y bugs.
- Inicio de sprint desde backlog.

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

## Notas de ejecucion

> **Importante:** Ejecutar pruebas con usuario owner para validar acciones de creacion de proyecto e inicio de sprint.

> **Importante:** Registrar evidencia visual por cada caso (captura de pantalla antes y despues) para soportar resultados de validacion.
