# Debug: Verificar qué se envía al flow

## Paso 1: Abre Developer Tools
- Presiona **F12** en la ventana de la aplicación
- Ve a la pestaña **Network**

## Paso 2: Envía un email de prueba
- Haz clic en "Enviar correo"
- En el modal, revisa que el correo sea: **halconp@gmail.com**
- Haz clic en "Confirmar y enviar email"

## Paso 3: Busca la solicitud al flow
En la pestaña Network de Developer Tools, busca una solicitud POST que contenga:
- Nombre: algo como "AdminActualizarSolicitud" o una URL con "/workflows/"
- Haz clic en esa solicitud

## Paso 4: Verifica el payload enviado
- Ve a la pestaña **Request** o **Payload**
- Deberías ver algo como:

```json
{
  "rowId": "...",
  "nuevoEstado": 856530001 o 856530002,
  "docFaltante": "...",
  "emailHtml": "<html>...</html>",
  "email": "halconp@gmail.com",        ⭐ ¿ESTÁ AQUÍ?
  "enviarEmail": true
}
```

## Paso 5: Reporta lo que ves
- ¿Aparece el campo "email" con el valor "halconp@gmail.com"?
- ¿O falta el campo "email" en el payload?

Si falta, el problema está en que el cliente no está pasando el email correctamente al flow.
