# Lineamientos de frontend Qualio

Este documento define la base visual y de implementacion para que las futuras entregas de frontend mantengan consistencia.

## 1. Objetivo

Construir interfaces coherentes entre pantallas, con reglas claras de color, tipografia, espaciado y estados de componentes.

## 2. Paleta oficial

### 2.1 Colores principales

- Azul principal: `#042467`
- Azul oscuro: `#041036`
- Azul brillante: `#03A7F4`

### 2.2 Colores secundarios

- Turquesa: `#057B82`
- Verde principal: `#2D9B57`
- Verde acento: `#6ABA44`

### 2.3 Neutros

- Blanco: `#FFFFFF`
- Gris claro: `#ECECEC`
- Gris azulado: `#6A7F98`

## 3. Tokens CSS base

Usar estas variables como fuente de verdad en estilos:

- `--color-primary`: `#042467`
- `--color-primary-dark`: `#041036`
- `--color-primary-bright`: `#03A7F4`
- `--color-turquoise`: `#057B82`
- `--color-success`: `#2D9B57`
- `--color-success-accent`: `#6ABA44`
- `--color-white`: `#FFFFFF`
- `--color-gray-light`: `#ECECEC`
- `--color-gray-blue`: `#6A7F98`

Regla: no usar hex sueltos en componentes nuevos si ya existe token equivalente.

## 4. Reglas de uso de color

- Primario (`--color-primary`): botones principales, titulos clave, acentos de navegacion.
- Primario oscuro (`--color-primary-dark`): texto fuerte y hover de boton primario.
- Primario brillante (`--color-primary-bright`): foco, resaltado de campos activos y estados interactivos.
- Turquesa (`--color-turquoise`): mensajes informativos, badges de estado neutral positivo.
- Verde (`--color-success`, `--color-success-accent`): estados de exito y confirmaciones.
- Gris claro (`--color-gray-light`): bordes y separadores.
- Gris azulado (`--color-gray-blue`): texto secundario, descripciones y metadatos.

## 5. Tipografia

- Fuente base: `Manrope`.
- Fallback: `Segoe UI`, `Tahoma`, `sans-serif`.
- Jerarquia minima:
  - H1: 2rem
  - H2: 1.5rem
  - Texto base: 1rem
  - Texto secundario: 0.9rem a 0.95rem

## 6. Espaciado y layout

- Escala de espaciado recomendada: `4, 8, 12, 16, 20, 24, 32`.
- Separacion vertical entre bloques de formulario: minimo `10px`.
- Contenedores principales con `padding` entre `18px` y `24px`.
- Diseno mobile-first con ajuste en `max-width: 520px`.

## 7. Componentes base (estilo minimo)

### 7.1 Boton primario

- Fondo: `--color-primary`
- Texto: blanco
- Hover: `--color-primary-dark`
- Disabled: opacidad reducida y cursor `not-allowed`

### 7.2 Inputs

- Borde normal: `--color-gray-light`
- Foco: borde `--color-primary-bright` + anillo de foco visible
- Radio de borde: `10px`

### 7.3 Mensajes de feedback

- Informativo: base turquesa suave
- Error: rojo con contraste adecuado
- Exito: verde con contraste adecuado

## 8. Accesibilidad minima obligatoria

- Mantener contraste legible entre texto y fondo.
- No comunicar estado solo por color (acompanar con texto).
- Inputs siempre con `label`.
- Estado focus visible en elementos interactivos.

## 9. Reglas de consistencia para futuras entregas

- Reutilizar tokens y patrones existentes antes de crear variaciones nuevas.
- Mantener el mismo radio de bordes y estilos base de controles.
- No mezclar paletas externas sin aprobacion.
- Cualquier cambio de paleta o tipografia debe actualizar este documento.

## 10. Estado actual de implementacion

La pantalla de autenticacion actual (`apps/web/src/styles.css`) ya fue alineada a esta paleta y sirve como referencia base para proximas vistas.
