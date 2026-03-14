# Plan de integracion Auth end-to-end (MySQL + API + Front)

## 1. Objetivo

Completar un flujo funcional de autenticacion de punta a punta en Qualio:

- Registro de usuario.
- Inicio de sesion.
- Mantenimiento de sesion.
- Cierre de sesion.
- Rutas protegidas en frontend.

Este plan asume que ya existe:

- Base de datos MySQL local `qualio_db`.
- Usuario tecnico `qualio_user` con permisos.
- Tablas `users` y `refresh_tokens`.
- Conexion backend a MySQL validada.

## 2. Estado actual resumido

- Frontend: existe UI de Login/Registro con validacion local.
- Backend: existe servicio base y healthcheck, sin modulo auth completo.
- Prisma: configurado para MySQL en el repositorio.

## 3. Estrategia de entrega por PR

Se recomienda avanzar en 4 PR cortos para reducir riesgo.

---

## PR1 - Base de autenticacion backend

### Alcance

- Crear modulo `auth` y modulo `users` en `apps/api`.
- Configurar JWT para emision de tokens.
- Configurar hashing de contrasena (Argon2 o Bcrypt).
- Definir DTOs de entrada/salida para login y registro.

### Entregables

- Estructura de modulos lista.
- Servicio de usuarios con busqueda por email y creacion.
- Servicio de auth con validacion de credenciales.

### Criterios de aceptacion

- El proyecto compila.
- Lint y tests del backend pasan.
- No se exponen contrasenas en respuestas.

---

## PR2 - Endpoints de registro, login y refresh

### Alcance

- Implementar `POST /auth/register`.
- Implementar `POST /auth/login`.
- Implementar `POST /auth/refresh`.
- Implementar `POST /auth/logout` (revocacion de refresh token).
- Persistir refresh tokens en tabla `refresh_tokens`.

### Reglas funcionales

- `register` crea usuario si email no existe.
- `login` valida email + password y devuelve tokens.
- `refresh` emite nuevo access token si refresh token es valido y no revocado.
- `logout` invalida el refresh token actual.

### Criterios de aceptacion

- Flujo completo funcionando via Postman/cURL.
- Errores claros para:
  - email ya registrado
  - credenciales invalidas
  - token invalido o expirado

---

## PR3 - Integracion frontend con API real

### Alcance

- Conectar formulario de registro con `POST /auth/register`.
- Conectar formulario de login con `POST /auth/login`.
- Crear cliente API centralizado.
- Mostrar errores del backend en UI.

### Manejo de sesion

- Guardar `accessToken` en cliente (estrategia definida por el equipo).
- Guardar metadata de usuario autenticado.
- Crear estado global de autenticacion.

### Criterios de aceptacion

- Usuario puede registrarse e iniciar sesion desde la UI.
- UI responde con mensajes correctos en exito/error.
- No quedan mensajes demo locales en auth.

---

## PR4 - Rutas protegidas, renovacion y cierre de sesion

### Alcance

- Proteger rutas privadas en frontend.
- Implementar renovacion automatica de sesion (`/auth/refresh`).
- Implementar boton y flujo de logout.
- Manejar expiracion de sesion y redireccion a login.

### Criterios de aceptacion

- Usuario autenticado accede a zona privada.
- Usuario sin sesion no puede entrar a rutas privadas.
- Logout revoca sesion y limpia estado local.

---

## 4. Contrato API minimo esperado

### `POST /auth/register`

- Entrada: `email`, `password`, `name` (segun decision de modelo).
- Salida recomendada: `user` + `accessToken` + `refreshToken`.

### `POST /auth/login`

- Entrada: `email`, `password`.
- Salida: `accessToken`, `refreshToken`, `user`.

### `POST /auth/refresh`

- Entrada: `refreshToken`.
- Salida: nuevo `accessToken` (y opcionalmente nuevo `refreshToken`).

### `POST /auth/logout`

- Entrada: `refreshToken` o identificador de sesion.
- Salida: confirmacion de cierre de sesion.

## 5. Checklist tecnico transversal

Aplicar en cada PR:

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

Y ademas:

- Actualizar docs si cambia contrato API.
- Mantener `.env.example` al dia.
- No versionar secretos reales.

## 6. Riesgos y mitigacion

- Riesgo: desalineacion entre frontend y backend.
  - Mitigacion: fijar contrato API antes de conectar UI.

- Riesgo: errores de seguridad en tokens.
  - Mitigacion: guardar hashes de refresh token y validar revocacion.

- Riesgo: UX confusa ante errores de autenticacion.
  - Mitigacion: mapa de mensajes claros por caso (email duplicado, password incorrecta, token vencido).

## 7. Definicion de terminado (Auth v1)

Se considera completado cuando:

- Registro y login funcionan desde frontend contra backend real.
- Existe proteccion de rutas privadas.
- Existe logout funcional.
- Existe renovacion de sesion con refresh token.
- Suite minima de pruebas pasa en frontend y backend.
