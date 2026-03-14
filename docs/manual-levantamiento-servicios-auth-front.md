# Manual de levantamiento local (Frontend + API + Auth)

## 1. Objetivo

Levantar todos los servicios necesarios para probar en local:

- Frontend (`apps/web`)
- Backend API (`apps/api`)
- Autenticacion (`/auth/*`)
- Conexion a MySQL

## 2. Requisitos previos

Antes de iniciar, confirma:

- Node.js 20+ instalado.
- npm disponible.
- MySQL local activo.
- Base de datos existente: `qualio_db`.
- Usuario tecnico existente: `qualio_user`.
- Tablas existentes: `users` y `refresh_tokens`.

## 3. Variables de entorno

### 3.1 API

Crea el archivo `apps/api/.env` con este contenido:

```env
DATABASE_URL="mysql://qualio_user:Wcv4rT5s@localhost:3306/qualio_db"
JWT_SECRET="cambiar-por-valor-seguro"
PORT=3000
```

### 3.2 Frontend

Crea el archivo `apps/web/.env` con este contenido:

```env
VITE_API_URL="http://localhost:3000"
```

## 4. Instalacion de dependencias

Desde la raiz del repositorio:

```bash
npm install
```

## 5. Levantar servicios (3 terminales)

## Terminal 1 - API

```bash
npm run start:dev --workspace @qualio/api
```

Resultado esperado:

- API activa en `http://localhost:3000`

## Terminal 2 - Frontend

```bash
npm run dev --workspace @qualio/web
```

Resultado esperado:

- Front activo en `http://localhost:5173` o el puerto que indique Vite.

## Terminal 3 - Verificacion manual (opcional)

Puedes usar esta terminal para ejecutar pruebas rapidas con `curl`.

## 6. Verificacion tecnica minima

### 6.1 API viva

```bash
curl http://localhost:3000/health
```

Esperado:

```json
{"status":"ok","service":"qualio-api"}
```

### 6.2 Conexion a base de datos

```bash
curl http://localhost:3000/health/db
```

Esperado:

```json
{"status":"ok","database":"mysql"}
```

## 7. Prueba funcional de autenticacion desde front

1. Abre el frontend en el navegador.
2. Ve al formulario de `Registro`.
3. Crea un usuario con correo y contrasena valida.
4. Verifica mensaje de exito.
5. Ve al formulario de `Login`.
6. Inicia sesion con ese usuario.
7. Verifica mensaje de sesion iniciada.

## 8. Validar sesion y tokens en navegador

En DevTools del navegador:

- Abre `Application` -> `Local Storage`.
- Verifica que existan:
  - `qualio_access_token`
  - `qualio_refresh_token`
  - `qualio_user`

## 9. Probar endpoints de auth desde API client (opcional)

### 9.1 Registrar

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"qa1@qualio.local","password":"Password123","name":"QA Uno"}'
```

### 9.2 Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa1@qualio.local","password":"Password123"}'
```

### 9.3 Refresh

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<tu_refresh_token>"}'
```

### 9.4 Me (ruta protegida)

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <tu_access_token>"
```

### 9.5 Logout

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<tu_refresh_token>"}'
```

## 10. Problemas comunes y solucion

## Error en `/health/db`

Causas frecuentes:

- `DATABASE_URL` ausente o incorrecta.
- MySQL apagado.
- Usuario sin permisos.

Solucion:

1. Validar `apps/api/.env`.
2. Reiniciar API.
3. Confirmar que MySQL esta activo.

## Front no conecta a API

Causas frecuentes:

- `VITE_API_URL` incorrecto.
- API no iniciada.

Solucion:

1. Validar `apps/web/.env`.
2. Reiniciar frontend.
3. Confirmar `http://localhost:3000/health`.

## Puerto ocupado

- Si `5173` esta ocupado, Vite usa otro puerto automaticamente.
- Abre la URL exacta que muestra la terminal del front.

## 11. Comandos de validacion completa

Desde la raiz:

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

Si los cuatro comandos pasan, el entorno local esta consistente para continuar desarrollo.
