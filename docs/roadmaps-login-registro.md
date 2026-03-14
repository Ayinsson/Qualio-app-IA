# Roadmap simple: Login y Registro

Este documento explica, en palabras sencillas, el plan para completar la parte de inicio de sesion y creacion de cuenta en Qualio.

La idea es que cualquier persona, aunque no sea tecnica, pueda entender que se va a hacer y en que orden.

## Objetivo

Que una persona pueda:

- Crear una cuenta nueva (Registro).
- Iniciar sesion con su correo y contrasena (Login).
- Entrar a una zona privada de la aplicacion de forma segura.

## Que ya tenemos hoy

- Ya existe una pantalla visual de Login y Registro.
- Ya se pueden escribir datos en formularios y ver validaciones basicas en pantalla.
- Todavia no hay conexion real con la base de datos para guardar usuarios o iniciar sesion de verdad.

## Roadmap paso a paso

### Paso 1: Definir reglas claras

Primero se acuerda como va a funcionar Login y Registro.

- Que datos pedimos para crear cuenta.
- Que mensaje sale si algo esta mal.
- Que pasa cuando el inicio de sesion es exitoso.

Resultado esperado:

- Un "acuerdo" claro de como se comporta el modulo.

### Paso 2: Preparar la parte interna del sistema

Se construye la base para manejar usuarios y seguridad.

- Crear el espacio interno para autenticacion.
- Preparar seguridad de contrasenas.
- Definir como se protege la zona privada.

Resultado esperado:

- La aplicacion queda lista para recibir usuarios reales.

### Paso 3: Guardar usuarios de forma real

Se conecta con base de datos para registrar cuentas.

- Guardar nombre, correo y contrasena de forma segura.
- Evitar correos repetidos.
- Preparar un usuario de prueba para validar el flujo.

Resultado esperado:

- El registro deja de ser "demo" y pasa a ser real.

### Paso 4: Activar Registro

Se completa la funcion de crear cuenta.

- Si los datos son correctos, se crea la cuenta.
- Si hay errores, se muestra un mensaje claro.

Resultado esperado:

- Cualquier persona puede crear su cuenta desde la app.

### Paso 5: Activar Login

Se completa la funcion de iniciar sesion.

- Validar correo y contrasena.
- Si todo esta bien, entrar al sistema.
- Si esta mal, mostrar error facil de entender.

Resultado esperado:

- El acceso al sistema funciona de punta a punta.

### Paso 6: Conectar la pantalla con la logica real

La interfaz actual se conecta con la parte interna.

- El formulario de Login hablara con el sistema real.
- El formulario de Registro tambien.
- Se guarda la sesion para no pedir login en cada clic.

Resultado esperado:

- Lo que el usuario ve en pantalla ya funciona de verdad.

### Paso 7: Proteger y revisar calidad

Se revisa seguridad y calidad antes de cerrar.

- Proteger paginas privadas.
- Revisar errores comunes.
- Probar casos de uso reales (crear cuenta, login correcto, login incorrecto).

Resultado esperado:

- Modulo estable, usable y seguro para continuar con el proyecto.

## Como sabremos que esta listo

Se considera completado cuando:

- Una persona nueva puede registrarse.
- Esa persona puede iniciar sesion.
- El sistema muestra mensajes claros si algo falla.
- La zona privada solo se abre con sesion valida.

## Orden recomendado de entrega

Para mantener control y reducir errores, se recomienda dividir en 5 entregas cortas:

1. Reglas y definiciones.
2. Base interna de seguridad.
3. Registro real.
4. Login real.
5. Conexion final con interfaz + pruebas.

## Nota final

Este roadmap esta hecho para avanzar paso a paso, sin saltos.
Primero hacemos que funcione bien, luego lo hacemos mas completo.
