**QUALIO**

Manual de instalación local de Qualio

Dependencias, configuración inicial y arranque del proyecto

| **Proyecto**     | Qualio                                   |
|------------------|------------------------------------------|
| **Frontend**     | React + Vite                             |
| **Backend**      | NestJS sobre Node.js (adaptador Express) |
| **Base técnica** | PostgreSQL + Prisma + OpenAI             |

*Documento técnico y guía de instalación local*

# 1. Objetivo

Este manual describe qué debes instalar en tu máquina para poder
desarrollar Qualio localmente con React, NestJS, PostgreSQL, Git y
OpenCode conectado a OpenAI.

# 2. Requisitos base del equipo

## 2.1 Herramientas obligatorias

| **Elemento** | **Definición**                                                 |
|--------------|----------------------------------------------------------------|
| Node.js      | Instalar una versión LTS moderna. Recomendado: Node.js 24 LTS. |
| npm          | Se instala junto con Node.js.                                  |
| Git          | Necesario para clonar, versionar y sincronizar con GitHub.     |
| PostgreSQL   | Motor de base de datos local.                                  |
| VS Code      | Editor recomendado para trabajar el proyecto.                  |
| OpenCode     | Agente de IA para terminal/IDE.                                |

# 3. Orden recomendado de instalación

1.  Instalar Git.

2.  Instalar Node.js LTS.

3.  Instalar PostgreSQL.

4.  Instalar VS Code.

5.  Instalar OpenCode.

6.  Configurar OpenAI API Key.

7.  Clonar o vincular el repositorio.

8.  Crear frontend y backend.

9.  Configurar variables de entorno.

10. Levantar base de datos y correr migraciones.

# 4. Instalación de dependencias globales

## 4.1 Git

Descarga e instala Git. Luego configura tu identidad global.

```
git --version

git config --global user.name "Tu Nombre"

git config --global user.email "tu-correo@ejemplo.com"
```

## 4.2 Node.js

Instala Node.js LTS. Después valida que npm también quedó disponible.

```
node -v

npm -v
```

## 4.3 PostgreSQL

Instala PostgreSQL y recuerda anotar la contraseña del usuario postgres.
Luego crea una base de datos llamada qualio.

```
psql -U postgres

CREATE DATABASE qualio;

\q
```

## 4.4 OpenCode

Puedes instalar OpenCode por npm si trabajarás con Node.js en Windows.

```
npm install -g opencode-ai

opencode --version
```

En Windows suele ser mejor usar WSL si quieres la experiencia más
estable de terminal, pero también puedes instalar OpenCode directamente
con npm.

# 5. Configuración de OpenAI para OpenCode

OpenCode puede leer credenciales almacenadas con su comando de
autenticación o detectar claves desde variables de entorno y archivos
.env.

```
# Windows PowerShell

setx OPENAI_API_KEY "tu_api_key"



# reinicia la terminal y valida

echo $env:OPENAI_API_KEY
```

También puedes iniciar autenticación desde OpenCode:

```
opencode auth login

opencode auth list
```

# 6. Clonar o conectar el repositorio

Si el repositorio ya existe en GitHub pero está vacío:

```
git clone https://github.com/tu-usuario/tu-repo.git

cd tu-repo
```

Si ya tienes archivos locales y deseas enlazarlos:

```
git init

git remote add origin https://github.com/tu-usuario/tu-repo.git

git branch -M main
```

# 7. Crear la estructura inicial del proyecto

```
mkdir apps

cd apps

npm create vite@latest web -- --template react-ts

npm install -g @nestjs/cli

nest new api
```

Cuando Nest pregunte el gestor de paquetes, puedes dejar npm para
mantener el entorno simple al inicio.

# 8. Dependencias del frontend

```
cd apps/web

npm install react-router-dom axios @tanstack/react-query react-hook-form
zod @hookform/resolvers

npm install @mui/material @emotion/react @emotion/styled

npm install -D eslint prettier
```

# 9. Dependencias del backend

```
cd apps/api

npm install @nestjs/config @nestjs/jwt @nestjs/passport passport
passport-jwt

npm install class-validator class-transformer bcrypt

npm install @prisma/client

npm install @nestjs/swagger swagger-ui-express

npm install -D prisma
```

# 10. Inicialización de Prisma

```
cd apps/api

npx prisma init
```

Luego reemplaza el contenido principal del archivo .env con tu conexión
local.

| DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/qualio" |
|------------------------------------------------------------------------|

# 11. Variables de entorno recomendadas

```
# apps/api/.env

DATABASE_URL="postgresql://postgres:tu_password@localhost:5432/qualio"

JWT_SECRET="un_valor_largo_y_seguro"

OPENAI_API_KEY="sk-..."

PORT=3000



# apps/web/.env

VITE_API_URL="http://localhost:3000"
```

# 12. Scripts mínimos esperados

```
# frontend

npm run dev



# backend

npm run start:dev



# prisma

npx prisma migrate dev --name init

npx prisma studio
```

# 13. Flujo de arranque diario

11. Abrir PostgreSQL o verificar que el servicio esté activo.

12. Entrar a apps/api y ejecutar npm run start:dev.

13. Entrar a apps/web y ejecutar npm run dev.

14. Abrir el navegador y probar frontend + backend.

15. Usar OpenCode desde la raíz del proyecto o desde el editor
    integrado.

# 14. Verificaciones rápidas

- node -v devuelve una versión instalada.

- npm -v devuelve una versión instalada.

- git --version responde correctamente.

- psql puede conectarse a la base local.

- opencode --version responde sin error.

- La API arranca y el frontend abre en modo desarrollo.

# 15. Problemas comunes

- Si Vite falla al instalar, revisa primero la versión de Node.

- Si Prisma no conecta, valida usuario, contraseña, puerto y nombre de
  base.

- Si OpenCode no reconoce el modelo, revisa OPENAI_API_KEY o ejecuta
  opencode auth login.

- Si GitHub rechaza el push por autenticación, usa token personal o SSH.

- Si Windows da problemas de PATH, reinicia la terminal o el equipo.

# 16. Recomendaciones finales

- Versiona un archivo .env.example, nunca tu .env real.

- Agrega node_modules, dist y archivos sensibles al .gitignore.

- Documenta cada decisión importante dentro de /docs.

- Mantén frontend y backend con comandos reproducibles y simples.
