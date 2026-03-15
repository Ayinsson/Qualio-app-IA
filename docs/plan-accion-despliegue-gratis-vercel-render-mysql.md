# Plan de accion: despliegue gratis (Vercel + Render + MySQL free-tier)

## 1) Objetivo

Publicar Qualio en un entorno gratuito para poder probar frontend y autenticacion sin depender de localhost.

Stack objetivo de despliegue:

- Frontend: **Vercel**
- Backend API: **Render (free)**
- Base de datos: **MySQL free-tier** (o MySQL-compatible)

## 2) Resultado esperado

Al finalizar este plan debes tener:

- URL publica del frontend.
- URL publica del backend.
- Login y registro funcionando contra base de datos en la nube.
- Flujo de sesion/token validado en entorno remoto.

## 3) Prerrequisitos

- Cuenta en GitHub con el repo actualizado (`dev`).
- Cuenta en Vercel.
- Cuenta en Render.
- Cuenta en proveedor de MySQL free-tier.
- Variables de entorno listas (ver seccion 7).

## 4) Proveedor de base de datos (free)

Opciones sugeridas:

1. **PlanetScale** (si hay plan gratuito disponible en tu region/cuenta).
2. **TiDB Cloud Serverless** (compatible con protocolo MySQL).
3. Otro proveedor MySQL free-tier que permita conexiones externas.

Nota: los planes free cambian con el tiempo. Verifica disponibilidad y limites antes de comprometerte.

## 5) Fase A - Preparar base de datos

1. Crear base de datos remota (ejemplo: `qualio_db`).
2. Crear usuario tecnico con permisos de lectura/escritura.
3. Ejecutar estructura SQL de auth desde:
   - `docs/estructura-bd-login-qualio.md`
4. Confirmar existencia de tablas:
   - `users`
   - `refresh_tokens`
5. Guardar cadena de conexion remota (`DATABASE_URL`).

Checklist de salida:

- Conexion remota valida.
- Tablas creadas.
- Usuario tecnico operativo.

## 6) Fase B - Desplegar backend en Render (free)

### 6.1 Crear servicio

- Tipo: **Web Service**.
- Repo: este repositorio.
- Rama inicial: `dev`.

### 6.2 Configuracion recomendada

- Root directory: raiz del repo.
- Build command:

```bash
npm install && npm run prisma:generate --workspace @qualio/api && npm run build --workspace @qualio/api
```

- Start command:

```bash
npm run start:prod --workspace @qualio/api
```

### 6.3 Variables de entorno en Render

- `DATABASE_URL` = cadena remota MySQL
- `JWT_SECRET` = valor fuerte
- `PORT` = (Render la define automaticamente; puedes no fijarla manualmente)

### 6.4 Verificaciones backend

- `GET /health` responde `ok`.
- `GET /health/db` responde `{"status":"ok","database":"mysql"}`.
- Endpoints auth responden en URL publica de Render.

Checklist de salida:

- API publica funcionando.
- Conexion DB en estado `ok`.

## 7) Fase C - Desplegar frontend en Vercel

### 7.1 Crear proyecto en Vercel

- Importar el repo desde GitHub.
- Configurar **Root Directory** en `apps/web`.

### 7.2 Variables de entorno en Vercel

- `VITE_API_URL` = URL publica del servicio Render (ejemplo: `https://tu-api.onrender.com`)

### 7.3 Build settings

- Framework preset: Vite (auto-detect).
- Build command: `npm run build`
- Output directory: `dist`

### 7.4 Verificaciones frontend

- La app carga sin errores de consola.
- Formularios Login/Registro envian peticiones a Render.
- Mensajes de error/exito visibles correctamente.

Checklist de salida:

- Frontend publico funcionando.
- Conexion front->api confirmada.

## 8) Fase D - Validacion funcional end-to-end

Ejecutar pruebas funcionales usando:

- `docs/pruebas-funcionales-login.md`

Casos minimos obligatorios:

1. Registro exitoso.
2. Login exitoso.
3. Login con credenciales invalidas.
4. `auth/me` con token valido.
5. Refresh token valido.
6. Logout y token revocado.

## 9) Riesgos de planes gratuitos y mitigacion

- **Cold start/suspension** en backend free.
  - Mitigacion: aceptar latencia inicial en demos y documentar este comportamiento.

- **Limites de cuota** en DB/API.
  - Mitigacion: usar datos de prueba minimos y limpiar sesiones viejas.

- **Cambios de politica free-tier**.
  - Mitigacion: mantener plan B con otro proveedor compatible MySQL.

## 10) Plan de ejecucion sugerido (1 dia)

1. Crear DB remota y cargar schema (1-2 horas).
2. Publicar API en Render y validar `/health/db` (1 hora).
3. Publicar Front en Vercel y conectar `VITE_API_URL` (30-60 min).
4. Ejecutar pruebas funcionales de login/sesion/token (1-2 horas).

## 11) Criterio de exito final

Se considera completado cuando:

- Puedes abrir la URL de Vercel desde cualquier red.
- Registro y login funcionan contra DB remota.
- Sesion/token funcionan en entorno cloud.
- Existe evidencia de pruebas funcionales aprobadas.
