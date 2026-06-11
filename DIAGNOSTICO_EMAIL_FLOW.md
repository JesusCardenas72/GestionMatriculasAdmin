# Diagnóstico: Email no llega desde AdminActualizarSolicitud

## ¿Qué se está enviando desde la aplicación?

Cuando haces clic en "Enviar correo" en Local, se envía esto al flow:

```json
{
  "rowId": "ID-de-la-matricula",
  "nuevoEstado": 856530001 | 856530002,  // PENDIENTE_VALIDACION o TRAMITADO
  "docFaltante": "observaciones del usuario",
  "emailHtml": "<html>...</html>",  // ⭐ HTML completo del email
  "email": "alumno@example.com",    // ⭐ CORREO DEL ALUMNO (de la pantalla local)
  "enviarEmail": true                // ⭐ Flag para enviar
}
```

## Checklist en Power Automate

Verifica que el flow **AdminActualizarSolicitud** tenga:

### ✅ 1. Trigger
- [ ] Es un trigger HTTP POST
- [ ] Acepta los parámetros: `rowId`, `nuevoEstado`, `docFaltante`, `emailHtml`, `email`, `enviarEmail`

### ✅ 2. Actualización en Dataverse
- [ ] Hay un paso que actualiza el registro con `nuevoEstado`
- [ ] Hay un paso que actualiza el campo `docFaltante`

### ✅ 3. **CRÍTICO: Envío de Email** ⚠️
Este es probablemente el problema:

- [ ] **Existe una acción "Send an email (V3)"** o similar
- [ ] Está condicionada a: `enviarEmail == true`
- [ ] **El campo "To" contiene: `@{triggerBody()['email']}`** (usa el email del payload, no de Dataverse)
- [ ] **El campo "Body" contiene: `emailHtml`** (no un template hardcodeado)
- [ ] El campo "Subject" está configurado
- [ ] El campo "Body Format" es **HTML** (no Plaintext)

### Ejemplo de cómo debería verse:

```
Send an email (V3)
├── To: @{triggerBody()['email']}                    ⭐ IMPORTANTE: del payload
├── Subject: Notificación de Matrícula
├── Body: @{triggerBody()['emailHtml']}
├── Body Format: HTML
└── Run this action if: @{triggerBody()['enviarEmail']}
```

### ✅ 4. Response
- [ ] El flow devuelve: `{ "ok": true }` al final

---

## Posibles problemas:

### ❌ Problema 1: El flow solo actualiza Dataverse sin enviar email
**Solución**: Añade una acción "Send an email (V3)" después de actualizar Dataverse

### ❌ Problema 2: El email está hardcodeado y no usa `emailHtml`
**Solución**: Cambia el Body a `@{triggerBody()['emailHtml']}`

### ❌ Problema 3: La acción de email no está condicionada
**Solución**: Añade condición `@equals(triggerBody()['enviarEmail'], true)`

### ❌ Problema 4: El Body Format es "Plaintext" en lugar de "HTML"
**Solución**: Cambia a HTML para que el email se vea correctamente

---

## Test rápido en Power Automate

1. Abre el flow AdminActualizarSolicitud
2. Haz clic en "Test"
3. Usa "Manually trigger a flow"
4. Pasa este payload:

```json
{
  "rowId": "test-123",
  "nuevoEstado": 856530002,
  "docFaltante": "Test de diagnóstico",
  "emailHtml": "<html><body><h1>Prueba de Email</h1><p>Si ves esto, el HTML se envía correctamente</p></body></html>",
  "email": "tu-email@example.com",
  "enviarEmail": true
}
```

5. Observa cada paso en el "run history"
6. ¿Llega a la acción "Send an email"?
7. ¿Esa acción se ejecuta o se salta?
8. ¿Se envió el email a `tu-email@example.com`?

---

## Confirmación

Una vez hayas verificado el flow:
- ✅ Si existe la acción de email → revisa el "To", "Subject" y "Body"
- ❌ Si NO existe → debes añadirla
- ✅ Si existe pero se salta → revisa la condición

Reporta qué encontraste.
