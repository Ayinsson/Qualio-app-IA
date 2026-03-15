# Checklist operativa: despliegue gratis (Vercel + Render + MySQL)

Usa este checklist en ejecucion real. Marca cada punto cuando lo completes.

## 1) Preparacion general

- [ ] Repo actualizado en GitHub (rama `dev` con cambios recientes).
- [ ] Cuentas activas en Vercel, Render y proveedor MySQL free-tier.
- [ ] Variables de entorno listas en un bloc seguro (sin subir secretos al repo).

## 2) Base de datos remota (MySQL free-tier)

- [ ] Crear instancia/cluster MySQL.
- [ ] Crear base de datos `qualio_db`.
- [ ] Crear usuario tecnico con permisos sobre `qualio_db`.
- [ ] Ejecutar script SQL de `docs/estructura-bd-login-qualio.md`.
- [ ] Verificar tablas `users` y `refresh_tokens`.
- [ ] Confirmar conectividad externa con `DATABASE_URL`.
- [ ] Guardar `DATABASE_URL` final para Render.

## 3) Backend en Render (free)

- [ ] Crear nuevo **Web Service** en Render.
- [ ] Conectar repo GitHub correcto.
- [ ] Seleccionar rama `dev`.
- [ ] Configurar Build Command:

```bash
npm install && npm run prisma:generate --workspace @qualio/api && npm run build --workspace @qualio/api
```

- [ ] Configurar Start Command:

```bash
npm run start:prod --workspace @qualio/api
```

- [ ] Configurar variables en Render:
  - [ ] `DATABASE_URL`
  - [ ] `JWT_SECRET`
- [ ] Ejecutar deploy inicial.
- [ ] Verificar `GET /health` en URL publica.
- [ ] Verificar `GET /health/db` en URL publica.
- [ ] Guardar URL final de la API (ej: `https://tu-api.onrender.com`).

## 4) Frontend en Vercel

- [ ] Crear proyecto en Vercel desde el repo.
- [ ] Configurar Root Directory = `apps/web`.
- [ ] Definir variable `VITE_API_URL` con la URL de Render.
- [ ] Verificar Build Command `npm run build`.
- [ ] Verificar Output Directory `dist`.
- [ ] Ejecutar deploy inicial.
- [ ] Abrir URL publica del frontend y validar carga sin errores.

## 5) Validacion funcional end-to-end

Referencia: `docs/pruebas-funcionales-login.md`.

- [ ] Registro exitoso desde frontend.
- [ ] Login exitoso desde frontend.
- [ ] Login fallido con credenciales invalidas.
- [ ] Verificacion de tokens en `Local Storage` (`qualio_access_token`, `qualio_refresh_token`, `qualio_user`).
- [ ] Probar `POST /auth/refresh`.
- [ ] Probar `POST /auth/logout`.
- [ ] Probar `GET /auth/me` con Bearer token valido.

## 6) Reglas de control rapido (go/no-go)

- [ ] Front carga correctamente en URL publica.
- [ ] API responde `health` y `health/db` en `ok`.
- [ ] Login/registro funcionales sin errores bloqueantes.
- [ ] Sesion y tokens operativos.

Si todos estan marcados, el despliegue MVP queda operativo para pruebas remotas.

## 7) Post-despliegue minimo recomendado

- [ ] Documentar URLs publicas en `README.md` o documento interno.
- [ ] Crear usuario de prueba QA.
- [ ] Registrar incidencias detectadas y prioridad.
- [ ] Planificar siguiente mejora: auto-refresh en frontend + cierre por inactividad.
