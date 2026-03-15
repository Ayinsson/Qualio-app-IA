# Comandos rapidos para levantar Qualio (tu caso)

Este archivo es para tu flujo diario, asumiendo que ya tienes todo instalado.

## 1) Desde la raiz del repo

Ruta esperada:

`C:\Proyectos dev\Repos Qualio-App\Qualio-app-IA`

## 2) Inicializar tablas auth (solo si aun no lo hiciste)

```bash
cd apps/api
npx prisma db execute --file "./prisma/sql/init_auth_postgres.sql" --schema "./prisma/schema.prisma"
cd ../..
```

## 3) Levantar API

En una terminal:

```bash
npm run start:dev --workspace @qualio/api
```

## 4) Levantar Frontend

En otra terminal:

```bash
npm run dev --workspace @qualio/web
```

## 5) Verificar que todo esta arriba

En una tercera terminal:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/db
```

Esperado en DB:

```json
{"status":"ok","database":"supabase-postgres"}
```

## 6) URL para probar

- Front: `http://localhost:5173` (o el puerto que imprima Vite)
- API: `http://localhost:3000`

## 7) Flujo funcional rapido

1. Abrir front.
2. Registrar usuario.
3. Hacer login.
4. Confirmar tokens en Local Storage:
   - `qualio_access_token`
   - `qualio_refresh_token`
   - `qualio_user`

## 8) Si algo falla

- Error `P1012`: revisar `apps/api/.env` y ejecutar Prisma desde `apps/api`.
- Error `P1001`: revisar `DATABASE_URL`/`DIRECT_URL` (pooler/direct).
- Front sin conexion: revisar `apps/web/.env` (`VITE_API_URL`).
