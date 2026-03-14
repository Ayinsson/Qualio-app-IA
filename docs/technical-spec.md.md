**QUALIO**

Especificación técnica base de Qualio

Arquitectura, stack oficial y lineamientos de desarrollo

| **Proyecto**     | Qualio                                   |
|------------------|------------------------------------------|
| **Frontend**     | React + Vite                             |
| **Backend**      | NestJS sobre Node.js (adaptador Express) |
| **Base técnica** | PostgreSQL + Prisma + OpenAI             |

*Documento técnico y guía de instalación local*

# 1. Propósito del documento

Este documento consolida la decisión técnica inicial de Qualio y traduce
las elecciones de stack en una base de trabajo clara para el equipo.
También deja establecida la forma correcta de interpretar la combinación
tecnológica seleccionada.

# 2. Decisión tecnológica oficial

La construcción de Qualio se define así: frontend en React, backend en
NestJS sobre Node.js y uso del adaptador HTTP de Express, que es una
forma coherente de combinar Express y NestJS sin duplicar
responsabilidades.

## 2.1 Stack aprobado

| **Elemento**         | **Definición**                                                 |
|----------------------|----------------------------------------------------------------|
| Frontend             | React con Vite y TypeScript.                                   |
| Backend              | NestJS sobre Node.js.                                          |
| Servidor HTTP        | Express como adaptador de NestJS.                              |
| Base de datos        | PostgreSQL.                                                    |
| ORM                  | Prisma.                                                        |
| Autenticación        | JWT con tokens de acceso y refresh token.                      |
| Consumo de IA        | OpenCode como agente local y OpenAI como proveedor de modelos. |
| Control de versiones | Git + GitHub.                                                  |

# 3. Observación técnica importante

React es la capa de interfaz del cliente y no utiliza Express. Express
vive en el backend. Por eso, la definición operativa correcta queda
redactada como: React en frontend y NestJS en backend, con Express como
motor HTTP por defecto del servidor.

# 4. Arquitectura base propuesta

- Cliente SPA desarrollado en React.

- API REST implementada con NestJS.

- Acceso a datos con Prisma hacia PostgreSQL.

- Autenticación y autorización centralizadas en backend.

- OpenCode como asistente de desarrollo conectado a OpenAI por API.

- Repositorio monorepo simple con carpetas separadas para frontend y
  backend.

```
qualio/

├─ apps/

│ ├─ web/ # Frontend React + Vite

│ └─ api/ # Backend NestJS

├─ docs/ # Documentación técnica

├─ .env.example

├─ package.json # Opcional si luego se usa workspace

└─ README.md
```

# 5. Componentes del frontend

Para el frontend se propone una SPA orientada a panel administrativo.

- React 19 o versión estable compatible con Vite.

- Vite como bundler y servidor de desarrollo.

- TypeScript para tipado estático.

- React Router para navegación.

- TanStack Query para cache y consumo de API.

- React Hook Form + Zod para formularios y validación.

- Material UI o equivalente como librería de interfaz.

# 6. Componentes del backend

El backend se implementará con NestJS manteniendo una estructura
modular.

- Módulo de autenticación.

- Módulo de usuarios.

- Módulo de proyectos.

- Módulo de casos de prueba.

- Módulo de ejecuciones.

- Módulo de bugs.

- Módulo de dashboard y métricas.

- Prisma para persistencia y migraciones.

- Swagger para documentación de API.

- Validaciones con class-validator y class-transformer.

# 7. Principios de construcción

- Separar claramente capa de presentación, lógica de negocio y acceso a
  datos.

- Mantener DTOs, servicios y controladores desacoplados.

- Configurar variables de entorno por ambiente.

- Aplicar validaciones tanto en frontend como en backend.

- Centralizar manejo de errores y logs.

- Diseñar desde el inicio pensando en multiempresa, aunque el MVP use un
  solo tenant lógico.

# 8. Dependencias recomendadas por proyecto

## 8.1 Frontend

| **Elemento**   | **Definición**                                 |
|----------------|------------------------------------------------|
| Base           | react, react-dom, vite, typescript             |
| Navegación     | react-router-dom                               |
| Estado y datos | @tanstack/react-query                          |
| Formularios    | react-hook-form, zod, @hookform/resolvers      |
| HTTP           | axios                                          |
| UI             | @mui/material, @emotion/react, @emotion/styled |
| Calidad        | eslint, prettier                               |

## 8.2 Backend

| **Elemento**         | **Definición**                                                         |
|----------------------|------------------------------------------------------------------------|
| Base                 | @nestjs/common, @nestjs/core, @nestjs/platform-express                 |
| Seguridad            | @nestjs/jwt, @nestjs/passport, passport, passport-jwt, bcrypt o argon2 |
| Validación           | class-validator, class-transformer                                     |
| Persistencia         | prisma, @prisma/client                                                 |
| Documentación        | @nestjs/swagger, swagger-ui-express                                    |
| Variables de entorno | @nestjs/config                                                         |
| Calidad              | eslint, prettier, jest, supertest                                      |

# 9. Integración de IA para desarrollo

OpenCode se usará como agente local de apoyo al desarrollo. OpenAI se
usará como proveedor de modelos, por lo que el proyecto debe contemplar
manejo seguro de credenciales y exclusión de secretos del repositorio.

- La clave OPENAI_API_KEY nunca debe subirse a Git.

- Se debe trabajar con archivo .env local y .env.example versionado.

- La integración de IA debe asistir desarrollo, documentación y
  generación de código, no reemplazar validación humana.

```
# .env.example

DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/qualio"

JWT_SECRET="cambiar-por-valor-seguro"

OPENAI_API_KEY="sk-..."

PORT=3000

VITE_API_URL="http://localhost:3000/api"
```

# 10. Riesgos y decisiones tempranas

- No mezclar Express como proyecto separado si NestJS ya lo usa como
  adaptador.

- No iniciar sin definir estructura de carpetas y convención de nombres.

- No trabajar con credenciales reales embebidas en el código.

- No dejar la documentación técnica fuera del repositorio.

- No posponer la configuración de ESLint, Prettier y Git hooks básicos.

# 11. Resultado esperado

Con esta definición, Qualio queda preparado para construirse como una
aplicación web moderna, mantenible y lista para evolucionar desde un MVP
hacia una plataforma de gestión de calidad más robusta.
