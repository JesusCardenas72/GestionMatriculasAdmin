# Flujo Completo: Enviar Correo desde Local

## 📋 Resumen del flujo implementado

Cuando haces clic en **"Enviar correo"** en una matrícula LOCAL:

```
1. Verifica si hay cambios pendientes de sincronizar
   ├─ SÍ → Sube automáticamente a la nube
   └─ NO → Continúa

2. Abre el modal de email

3. Usuario edita observaciones (opcional)

4. Usuario haz clic en "Confirmar y enviar email"

5. Se envía al flow AdminActualizarSolicitud:
   {
     "rowId": "ID",
     "nuevoEstado": 856530001 | 856530002,
     "docFaltante": "observaciones",
     "emailHtml": "<html>...</html>",
     "email": "alumno@example.com",
     "enviarEmail": true
   }

6. Power Automate:
   ├─ Actualiza el registro en Dataverse
   ├─ Obtiene el registro actualizado
   ├─ Si enviarEmail == true:
   │  └─ Envía el email al correo del alumno
   └─ Devuelve { "ok": true }

7. Modal se cierra
```

---

## 🔧 Cambios realizados

### 1. [LocalScreen.tsx:464-509](src/screens/LocalScreen.tsx:464)

La función `handleEnviarCorreo()` ahora:
- ✅ Verifica si `selected._pendienteSubida` es true
- ✅ Si hay cambios pendientes, sube automáticamente a la nube
- ✅ Luego abre el modal de email

```typescript
async function handleEnviarCorreo() {
  if (!selected || !estadoSeleccionado) return;

  // Si tiene cambios pendientes de subida, sube primero
  if (selected._pendienteSubida) {
    setIsSaving(true);
    // ... código de subida ...
  }

  // Abre el modal de email
  setShowEmailModal(true);
}
```

### 2. [types.ts:51-57](src/api/types.ts:51)

Añadido campo `email` al payload:
```typescript
export interface ActualizarSolicitudInput {
  rowId: string;
  nuevoEstado: EstadoTramite;
  docFaltante?: string;
  emailHtml?: string;
  email?: string;        // ⭐ NUEVO
  enviarEmail?: boolean;
}
```

### 3. [SolicitudDetail.tsx:451-470](src/components/SolicitudDetail.tsx:451)

Pasando el email en los manejadores:
```typescript
{ rowId, nuevoEstado, ..., email: solicitud.email, enviarEmail: true }
```

---

## ⚠️ IMPORTANTE: Cambios en Power Automate

El flow **AdminActualizarSolicitud** necesita ser actualizado:

### En ambas acciones "Send an email (V2)":

**Campo "To":**
```
❌ Cambiar de:  @outputs('Get_matricula')?['body/cpmmr_email']
✅ Cambiar a:   @triggerBody()?['email']
```

**En el "default" case:**
```
❌ Cambiar de:  "<p class=\"editor-paragraph\">@{triggerBody()?['emailHtml']}</p>"
✅ Cambiar a:   @triggerBody()?['emailHtml']
```

---

## ✅ Flujo seguro garantizado

**Ventajas de esta implementación:**

1. ✅ Los datos siempre están sincronizados con la nube antes de enviar
2. ✅ El email se envía al correo correcto de Dataverse
3. ✅ No hay conflictos de datos desincronizados
4. ✅ El usuario no necesita pensar en "subir primero"
5. ✅ El botón se deshabilita durante la subida para evitar clicks múltiples

---

## 🚀 Paso a paso para el usuario

1. **Edita los datos en Local** (nombre, email, etc.)
2. **Haz clic en "Enviar correo"**
   - Si hay cambios sin sincronizar → Se suben automáticamente
   - Se abre el modal de email
3. **Revisa el email** (preview en tiempo real)
4. **Edita observaciones** (si es necesario)
5. **Haz clic en "Confirmar y enviar email"**
6. **El email se envía** ✅

---

## 📊 Estados soportados

El flow envía emails automáticos para:

| Estado | Plantilla | Caso en Switch |
|--------|-----------|--------|
| **PENDIENTE_VALIDACION** (856530001) | "Documentación requerida" | Case: 856530001 |
| **TRAMITADO** (856530002) | "Matrícula tramitada" | Default |
| **PENDIENTE_TRAMITACION** (856530000) | Sin envío automático | — |

---

## 🧪 Test

Para verificar que todo funciona:

1. Abre una matrícula en Local
2. Cambia algún dato (ej: el email)
3. Haz clic en "Enviar correo"
4. Verifica que:
   - Se suben los datos (si había cambios)
   - Se abre el modal
   - Se envía el email al correo correcto
