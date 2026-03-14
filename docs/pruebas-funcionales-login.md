# Set de pruebas funcionales de Login, Sesion y Token (Frontend)

## 1. Objetivo

Definir casos de prueba funcionales para validar el comportamiento de autenticacion desde el frontend de Qualio, con foco en:

- Login
- Registro
- Manejo de sesion
- Manejo de tokens
- Cierre de sesion

## 2. Alcance

Estas pruebas se ejecutan desde la interfaz web y validan resultados visibles para el usuario o validables con herramientas del navegador (Network/Application).

## 3. Set de casos

| ID Caso | Descripcion de lo que se va a probar | Resultado esperado |
|---|---|---|
| FL-LOGIN-001 | Iniciar sesion con credenciales validas (`email` y `password` correctos). | El sistema autentica al usuario, muestra mensaje de exito y guarda `accessToken`, `refreshToken` y `user` en almacenamiento local. |
| FL-LOGIN-002 | Intentar iniciar sesion con correo invalido (formato incorrecto). | El formulario bloquea el envio y muestra error de validacion en campo correo. |
| FL-LOGIN-003 | Intentar iniciar sesion con password menor al minimo requerido. | El formulario bloquea el envio y muestra error de validacion en campo contrasena. |
| FL-LOGIN-004 | Intentar iniciar sesion con credenciales incorrectas. | El backend responde error y el frontend muestra mensaje funcional de credenciales invalidas. |
| FL-LOGIN-005 | Validar estado visual durante el envio de login. | El boton de login cambia a estado de carga (`Validando...`) y evita multiples envios simultaneos. |
| FL-REG-001 | Registrar usuario nuevo con datos validos. | El sistema crea la cuenta, muestra mensaje de exito y guarda tokens/sesion en almacenamiento local. |
| FL-REG-002 | Intentar registrar con correo ya existente. | El sistema muestra mensaje funcional indicando que el correo ya esta registrado. |
| FL-REG-003 | Intentar registrar con password y confirmacion diferentes. | El frontend muestra error de validacion y no envia solicitud al backend. |
| FL-REG-004 | Intentar registrar con nombre por debajo del minimo requerido. | El frontend muestra error de validacion en nombre y bloquea envio. |
| FL-REG-005 | Validar estado visual durante el envio de registro. | El boton de registro cambia a estado de carga (`Creando...`) y evita envio duplicado. |
| FL-TOKEN-001 | Verificar que despues de login exitoso existan tokens en almacenamiento local. | Existen `qualio_access_token` y `qualio_refresh_token` con valores no vacios. |
| FL-TOKEN-002 | Verificar que despues de registro exitoso se persista usuario de sesion. | Existe `qualio_user` con estructura JSON valida (`id`, `email`, `name`, `emailVerified`). |
| FL-TOKEN-003 | Forzar uso de access token expirado para endpoint protegido (`/auth/me`). | El frontend recibe error de autorizacion; si hay flujo refresh, debe renovar token y reintentar, de lo contrario informar sesion expirada. |
| FL-TOKEN-004 | Validar refresco de sesion con `refreshToken` valido. | El sistema obtiene nuevos tokens y mantiene sesion activa sin pedir login manual. |
| FL-TOKEN-005 | Validar comportamiento con `refreshToken` invalido o revocado. | El sistema cierra la sesion local, limpia tokens y solicita iniciar sesion nuevamente. |
| FL-SESION-001 | Cerrar sesion desde la UI (logout). | Se ejecuta logout en backend, se revoca refresh token y se eliminan datos de sesion del frontend. |
| FL-SESION-002 | Abrir una ruta protegida sin token activo. | El usuario no accede al contenido privado y es redirigido a login. |
| FL-SESION-003 | Recargar navegador con sesion valida previamente guardada. | La app reconoce sesion activa y mantiene estado autenticado sin pedir login inmediato. |
| FL-SESION-004 | Simular inactividad mayor al tiempo definido por politica (cuando exista). | El sistema cierra sesion por inactividad y solicita reautenticacion. |
| FL-SESION-005 | Simular dos intentos rapidos de envio del mismo formulario. | Solo se procesa un envio; no se crean sesiones duplicadas ni solicitudes redundantes. |

## 4. Evidencia recomendada por caso

Para cada ejecucion registrar:

- Fecha y entorno (local/dev).
- ID del caso.
- Resultado (Aprobado/Fallido).
- Captura o video corto (UI y/o Network).
- Observaciones y errores encontrados.

## 5. Criterio de aprobacion global

El modulo se considera funcionalmente aceptado cuando:

- Todos los casos criticos de login/registro/sesion/token pasan.
- No hay bloqueos de acceso por errores de token en flujos validos.
- Los mensajes de error son claros para usuario final.
