# Verificación en Power Automate - AdminActualizarSolicitud

## 🔴 URGENTE: El email no llega

Sigue estos pasos **en orden** para diagnosticar dónde está el problema.

---

## PASO 1: ¿Existe la acción "Send an email"?

1. Abre el flow **AdminActualizarSolicitud** en Power Automate
2. En el editor, busca una acción que diga **"Send an email"** o **"Send email (V3)"**
3. Si **NO la ves**, ve a PASO 6 (necesitas añadirla)
4. Si **SÍ la ves**, continúa con PASO 2

---

## PASO 2: ¿La acción está HABILITADA?

1. Busca la acción "Send an email"
2. En la esquina superior derecha de esa acción, ¿hay un ícono de "ojos tachados" ❌?
   - **SÍ** → La acción está DESHABILITADA. Haz clic para habilitarla
   - **NO** → Está habilitada, continúa con PASO 3

---

## PASO 3: ¿La acción tiene una CONDICIÓN que la salta?

1. En la acción "Send an email", ¿ves un cartel azul que dice "+" o ves "+Add"?
2. Haz clic en **"..."** (tres puntos) en la acción
3. Elige **"Configure run after"**
4. ¿Aparece una condición como "If email is true" o algo similar?
   - **SÍ** → Verifica que la condición sea: `@equals(triggerBody()['enviarEmail'], true)`
   - **NO** → La condición podría estar configurada incorrectamente

---

## PASO 4: Verifica los CAMPOS de "Send an email"

### Campo "To":
```
Debe ser exactamente: @{triggerBody()['email']}

❌ NO debe ser:
  - Una búsqueda en Dataverse
  - Un correo hardcodeado
  - Un valor estático

✅ DEBE ser:
  - @{triggerBody()['email']}
```

### Campo "Subject":
```
Puede ser cualquier cosa, por ejemplo:
  - "Notificación de Matrícula"
  - "Estado de tu solicitud"
```

### Campo "Body":
```
Debe ser exactamente: @{triggerBody()['emailHtml']}

❌ NO debe ser:
  - Un template HTML escrito en el flow
  - Un correo de prueba fijo

✅ DEBE ser:
  - @{triggerBody()['emailHtml']}
```

### Campo "Body Format":
```
DEBE SER: HTML (no "Plain text")
```

---

## PASO 5: Test MANUAL en Power Automate

1. En la parte superior del flow, haz clic en **"Test"**
2. Elige **"Manually trigger a flow"**
3. Haz clic en **"Test"** (botón azul)
4. Copia este JSON en el campo de entrada:

```json
{
  "rowId": "test-001",
  "nuevoEstado": 856530002,
  "docFaltante": "Test de envío de email",
  "emailHtml": "<html><body><h1>Prueba</h1><p>Si recibes esto, el flow funciona</p></body></html>",
  "email": "tu-email@tudominio.com",
  "enviarEmail": true
}
```

⚠️ **Reemplaza `tu-email@tudominio.com` con tu propio email**

5. Haz clic en **"Run flow"**
6. Observa los resultados:
   - ¿El flow completa sin errores (verde)?
   - ¿Recibiste el email?

### Si el test falla:
- Haz clic en cada acción para ver el error
- Busca una acción en rojo con un mensaje de error
- Copia el error y revísalo

---

## PASO 6: Si NO existe la acción "Send an email"

Necesitas AÑADIRLA:

1. En el flow, haz clic en **"+ New step"**
2. Busca **"Send an email (V3)"** de Office 365 Outlook
3. Configura:
   - **To**: `@{triggerBody()['email']}`
   - **Subject**: `Notificación de Matrícula`
   - **Body**: `@{triggerBody()['emailHtml']}`
   - **Body Format**: `HTML`
4. IMPORTANTE: Después de "Update a record", añade esta acción
5. Guarda el flow

---

## PASO 7: CONDICIÓN para enviar solo si es necesario

Después de crear la acción "Send an email", añade una condición:

1. Haz clic en **"..."** en la acción
2. Elige **"Configure run after"**
3. Asegúrate de que se ejecute siempre (sin condiciones especiales)
4. O, si quieres que se ejecute solo cuando `enviarEmail` sea true:
   - Rodea la acción con un **"Condition"**
   - Expresión: `@equals(triggerBody()['enviarEmail'], true)`
   - True: incluye la acción "Send an email"
   - False: no hace nada

---

## RESUMEN DE CHECKLIST

- [ ] La acción "Send an email" EXISTE
- [ ] La acción está HABILITADA
- [ ] Campo "To" = `@{triggerBody()['email']}`
- [ ] Campo "Body" = `@{triggerBody()['emailHtml']}`
- [ ] Campo "Body Format" = HTML
- [ ] El test manual ENVÍA el email correctamente
- [ ] El flujo completa sin errores

---

## Si aún no funciona:

1. Toma una **screenshot del flow completo**
2. Toma una **screenshot del test y sus resultados**
3. Comparte esa información

Con eso podré ayudarte a identificar el problema exacto.
