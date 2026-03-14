# Estructura de Base de Datos Relacional para Login en Qualio

## 1. Objetivo

Este documento describe la estructura base de datos relacional mínima para soportar el proceso de autenticación en Qualio usando MySQL local.

Incluye:

- Base de datos `qualio_db`
- Usuario técnico de base de datos `qualio_user`
- Tabla `users`
- Tabla `refresh_tokens`
- Datos de usuario de prueba
- Script SQL de referencia

---

## 2. Base de datos

**Nombre de la base de datos:** `qualio_db`

### Script de creación

```sql
CREATE DATABASE IF NOT EXISTS qualio_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

---

## 3. Usuario técnico de MySQL

Este usuario será utilizado por la aplicación para conectarse a la base de datos local.

### Datos del usuario de base de datos

- **Usuario:** `qualio_user`
- **Host:** `localhost`
- **Contraseña:** `Wcv4rT5s`
- **Base asignada:** `qualio_db`

### Script de creación del usuario y permisos

```sql
CREATE USER IF NOT EXISTS 'qualio_user'@'localhost'
IDENTIFIED BY 'Wcv4rT5s';

GRANT ALL PRIVILEGES ON qualio_db.* TO 'qualio_user'@'localhost';
FLUSH PRIVILEGES;
```

### Cadena de conexión sugerida para el proyecto

```env
DATABASE_URL="mysql://qualio_user:Wcv4rT5s@localhost:3306/qualio_db"
```

---

## 4. Modelo relacional propuesto para autenticación

La autenticación del sistema se soporta con dos tablas principales:

1. `users`
2. `refresh_tokens`

### Relación entre tablas

- Un usuario puede tener múltiples refresh tokens activos o históricos.
- Cada registro en `refresh_tokens` pertenece a un único usuario.
- La relación es **uno a muchos**:
  - `users (1)` → `refresh_tokens (N)`

---

## 5. Tabla `users`

Esta tabla almacena la información principal del usuario para autenticación.

### Estructura

| Campo | Tipo | Nulo | Llave | Default | Descripción |
|---|---|---:|---|---|---|
| `id` | `VARCHAR(36)` | No | PK | - | Identificador único del usuario |
| `email` | `VARCHAR(191)` | No | UNIQUE | - | Correo del usuario usado para login |
| `password_hash` | `VARCHAR(255)` | No | - | - | Hash seguro de la contraseña |
| `name` | `VARCHAR(100)` | Sí | - | `NULL` | Nombre visible del usuario |
| `is_active` | `BOOLEAN` | No | - | `TRUE` | Indica si la cuenta está activa |
| `email_verified` | `BOOLEAN` | No | - | `FALSE` | Indica si el correo fue verificado |
| `failed_login_attempts` | `INT` | No | - | `0` | Número de intentos fallidos |
| `locked_until` | `DATETIME` | Sí | - | `NULL` | Fecha hasta la que la cuenta está bloqueada |
| `created_at` | `DATETIME` | No | - | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | `DATETIME` | No | - | `CURRENT_TIMESTAMP` | Fecha de última actualización |

### Restricciones

- `PRIMARY KEY (id)`
- `UNIQUE KEY uq_users_email (email)`

### Script SQL

```sql
CREATE TABLE users (
  id VARCHAR(36) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);
```

---

## 6. Tabla `refresh_tokens`

Esta tabla almacena los tokens de refresco asociados a cada usuario para mantener la sesión iniciada de forma segura.

### Estructura

| Campo | Tipo | Nulo | Llave | Default | Descripción |
|---|---|---:|---|---|---|
| `id` | `VARCHAR(36)` | No | PK | - | Identificador único del token |
| `user_id` | `VARCHAR(36)` | No | FK | - | Usuario propietario del token |
| `token_hash` | `VARCHAR(255)` | No | - | - | Hash del refresh token |
| `user_agent` | `VARCHAR(255)` | Sí | - | `NULL` | Navegador o dispositivo origen |
| `ip_address` | `VARCHAR(45)` | Sí | - | `NULL` | Dirección IP del origen |
| `expires_at` | `DATETIME` | No | INDEX | - | Fecha de expiración |
| `revoked_at` | `DATETIME` | Sí | - | `NULL` | Fecha de revocación |
| `created_at` | `DATETIME` | No | - | `CURRENT_TIMESTAMP` | Fecha de creación |

### Restricciones

- `PRIMARY KEY (id)`
- `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
- `INDEX idx_refresh_tokens_user_id (user_id)`
- `INDEX idx_refresh_tokens_expires_at (expires_at)`

### Script SQL

```sql
CREATE TABLE refresh_tokens (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_refresh_tokens_user_id (user_id),
  KEY idx_refresh_tokens_expires_at (expires_at),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
```

---

## 7. Diagrama relacional simplificado

```text
users
-----
id (PK)
email (UNIQUE)
password_hash
name
is_active
email_verified
failed_login_attempts
locked_until
created_at
updated_at

        1 ────────────────< N

refresh_tokens
--------------
id (PK)
user_id (FK -> users.id)
token_hash
user_agent
ip_address
expires_at
revoked_at
created_at
```

---

## 8. Datos del usuario de prueba

Se define un usuario de prueba para validar el flujo de autenticación.

### Datos del usuario de prueba

- **ID:** `usr_001`
- **Nombre:** `Administrador`
- **Email:** `admin@qualio.local`
- **Password hash:** `$argon2id$ejemplo_hash_generado_por_backend`
- **Activo:** `true`
- **Correo verificado:** `false`
- **Intentos fallidos:** `0`
- **Bloqueado hasta:** `NULL`

> Nota: En un entorno real, la contraseña del usuario no debe insertarse en texto plano. El backend debe generar el valor de `password_hash` usando Argon2 antes de guardar el usuario.

### Script SQL del usuario de prueba

```sql
INSERT INTO users (
  id,
  email,
  password_hash,
  name,
  is_active,
  email_verified,
  failed_login_attempts,
  locked_until
) VALUES (
  'usr_001',
  'admin@qualio.local',
  '$argon2id$ejemplo_hash_generado_por_backend',
  'Administrador',
  TRUE,
  FALSE,
  0,
  NULL
);
```

---

## 9. Script SQL completo de referencia

```sql
CREATE DATABASE IF NOT EXISTS qualio_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'qualio_user'@'localhost'
IDENTIFIED BY 'Wcv4rT5s';

GRANT ALL PRIVILEGES ON qualio_db.* TO 'qualio_user'@'localhost';
FLUSH PRIVILEGES;

USE qualio_db;

CREATE TABLE users (
  id VARCHAR(36) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE refresh_tokens (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_refresh_tokens_user_id (user_id),
  KEY idx_refresh_tokens_expires_at (expires_at),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

INSERT INTO users (
  id,
  email,
  password_hash,
  name,
  is_active,
  email_verified,
  failed_login_attempts,
  locked_until
) VALUES (
  'usr_001',
  'admin@qualio.local',
  '$argon2id$ejemplo_hash_generado_por_backend',
  'Administrador',
  TRUE,
  FALSE,
  0,
  NULL
);
```

---

## 10. Ubicación sugerida dentro del repositorio

```text
docs/estructura-bd-login-qualio.md
```

---

## 11. Observaciones finales

- El usuario `qualio_user` debe usarse únicamente para acceso de la aplicación a `qualio_db`.
- La contraseña del usuario final nunca debe guardarse en texto plano.
- El campo `password_hash` debe ser generado desde el backend con una función de hash segura.
- La tabla `refresh_tokens` permite manejar sesiones renovables y revocables.
- Esta estructura es suficiente para iniciar el módulo de autenticación del MVP de Qualio.
