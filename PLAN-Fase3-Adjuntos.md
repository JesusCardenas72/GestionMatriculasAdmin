# Plan Fase 3 — Ver/descargar adjuntos del solicitante en GestionMatriculasAdmin

> Documento autocontenido. Puede desarrollarse desde cero sin contexto previo.
> Repo de esta app: `G:\Dev\GestionMatriculasAdmin`.
> Repo de la web pública (ya modificado): `G:\Dev\Matriculación-digital`.

## 1. Contexto y motivación

La web pública de matriculación **cambió** cómo guarda los documentos que adjunta el
solicitante (DNI, justificantes, etc.):

- **Antes:** el navegador fusionaba el formulario + todos los adjuntos en **un único PDF**
  (con pdf-lib/pdf.js) y lo subía a la columna File `cpmmr_solicitudpdf`. Esto fallaba con
  PDFs cifrados "contra escritura", imágenes HEIC de móviles antiguos y producía páginas en
  blanco. Algunos adjuntos directamente **no llegaban**.
- **Ahora (Fase 1+2, ya en producción):** `cpmmr_solicitudpdf` contiene **solo el PDF del
  formulario**. Cada adjunto **original** se guarda como una **Nota (annotation)** de
  Dataverse vinculada a la matrícula, con sus **bytes en bruto** (sin reprocesar → el cifrado
  ya no importa). Lo hace un flow de Power Automate `PublicSubirAdjunto` que crea la Nota y la
  relaciona con `cpmmr_matriculas`.

**Consecuencia para esta app:** hoy `GestionMatriculasAdmin` solo descarga
`cpmmr_solicitudpdf` (vía flow `AdminObtenerPDF`) y **no ve las Notas**. Los adjuntos del
solicitante son invisibles. Esta Fase 3 añade: (a) un flow para listar/descargar las Notas y
(b) el código para mostrarlas en la ficha de detalle.

**Objetivo:** en la ficha de cada matrícula, una sección **"Documentos adjuntos"** que liste
las Notas y permita **ver** (PDF/imagen) y **descargar** cada una.

### Modelo de datos en Dataverse (tabla estándar `annotations` / Notas)

| Columna | Significado |
|---|---|
| `annotationid` | PK de la Nota |
| `filename` | nombre original del fichero (ej. `dni.pdf`) |
| `mimetype` | tipo MIME (ej. `application/pdf`, `image/jpeg`) |
| `documentbody` | **contenido en base64** |
| `isdocument` | `true` cuando es un fichero adjunto |
| `_objectid_value` | GUID de la matrícula (`cpmmr_matriculas`) a la que pertenece |

Prerrequisito ya cumplido: la tabla `cpmmr_matricula` tiene "Notas (incluye archivos
adjuntos)" habilitado; `GET .../api/data/v9.2/annotations?$top=1` responde OK.

Compatibilidad: las matrículas **antiguas** (~350) no tienen Notas → la sección saldrá vacía
para ellas, lo cual es correcto. Su PDF combinado en `cpmmr_solicitudpdf` se sigue viendo
igual que hoy.

---

## 2. Fase 3a — Flow Power Automate `AdminObtenerAttachments`

Mismo patrón que los demás flows Admin (HTTP POST + cabecera `x-api-key`). Recibe `{ rowId }`,
lista las Notas de esa matrícula y las devuelve.

### Trigger: "Cuando se recibe una solicitud HTTP" (POST)
Esquema JSON del cuerpo:
```json
{ "type": "object", "properties": { "rowId": { "type": "string" } } }
```

### (Recomendado) Validación x-api-key
Igual que el resto de flows Admin: una **Condición** al inicio que compare
`@triggerOutputs()?['headers']?['x-api-key']` con el secreto compartido; si no coincide →
acción **Response 401** y terminar. (Copia este patrón de `AdminObtenerPDF` /
`AdminListarSolicitudes` para que sea idéntico.)

### Acción: Dataverse "Enumerar filas" (List rows), tabla `annotations`
- **Seleccionar columnas:** `annotationid,filename,mimetype,documentbody`
- **Filtrar filas:** `_objectid_value eq @{triggerBody()?['rowId']} and isdocument eq true`
  *(GUID sin comillas; si lo metes por `fx`:
  `concat('_objectid_value eq ', triggerBody()?['rowId'], ' and isdocument eq true')`)*

### Acción: "Respuesta" (Response)
- **Código de estado:** `200`
- **Cuerpo:**
```json
{ "attachments": @{outputs('List_rows')?['body/value']} }
```
*(Ajusta `List_rows` al nombre interno real de tu acción si difiere — míralo en su Peek code.)*

### Prueba aislada del flow
Usa un `rowId` de una matrícula con adjuntos. Con PowerShell:
```powershell
$url  = "URL_DEL_TRIGGER_AdminObtenerAttachments"
Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" `
  -Headers @{ "x-api-key" = "TU_API_KEY" } `
  -Body (@{ rowId = "GUID_MATRICULA" } | ConvertTo-Json)
```
Debe devolver `{ attachments: [ { annotationid, filename, mimetype, documentbody }, ... ] }`.

> Guarda la URL del trigger: se configura en la app (campo nuevo del modal de Conexión).

---

## 3. Fase 3b — Cambios de código en la app admin

Orden recomendado. Todos los snippets siguen el estilo existente.

### 3b.1 — `electron/config-store.ts`: nueva URL en `AppConfig`
Añadir a la interfaz `AppConfig` (junto al resto de `url*`), **opcional** para no romper
configuraciones ya guardadas:
```ts
  /** Flow AdminObtenerAttachments — lista las Notas (adjuntos) de una matrícula. */
  urlObtenerAttachments?: string;
```

### 3b.2 — `src/api/types.ts`: tipos del adjunto
Añadir junto a `ObtenerPDFResponse`:
```ts
export interface Attachment {
  annotationId: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface ObtenerAttachmentsResponse {
  attachments: Attachment[];
}
```

### 3b.3 — `src/api/solicitudes.ts`: función `obtenerAttachments`
Añadir el tipo crudo de Dataverse y la función (mapeo Dataverse→dominio, como `mapSolicitud`).
Importar `Attachment` desde `./types`.
```ts
interface DataverseAnnotation {
  annotationid: string;
  filename: string | null;
  mimetype: string | null;
  documentbody: string | null;
}

/** Lista los adjuntos (Notas) de una matrícula. Devuelve [] si no hay flow configurado. */
export async function obtenerAttachments(
  cfg: AppConfig,
  rowId: string,
): Promise<Attachment[]> {
  if (!cfg.urlObtenerAttachments) return [];
  const res = await postFlow<{ attachments: DataverseAnnotation[] }>(
    cfg.urlObtenerAttachments,
    cfg.apiKey,
    { rowId },
    "AdminObtenerAttachments",
    60000,
  );
  return (res.attachments ?? []).map((a) => ({
    annotationId: a.annotationid,
    fileName: a.filename ?? "documento",
    mimeType: a.mimetype ?? "application/octet-stream",
    contentBase64: a.documentbody ?? "",
  }));
}
```

### 3b.4 — `src/hooks/useSolicitudes.ts`: hook `useAttachments`
Añadir la key y el hook (mirando el patrón de `usePdf`). Importar `obtenerAttachments` y el
tipo `Attachment`.
```ts
// en `keys`:
  attachments: (rowId: string) => ["attachments", rowId] as const,

export function useAttachments(cfg: AppConfig, rowId: string | null) {
  return useQuery<Attachment[]>({
    queryKey: rowId ? keys.attachments(rowId) : ["attachments", "none"],
    queryFn: () => obtenerAttachments(cfg, rowId!),
    enabled: !!rowId && !!cfg.urlObtenerAttachments,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
```

### 3b.5 — `src/components/modals/ConexionModal.tsx`: campo en el modal
1. En el `schema` zod, añadir (opcional, como `urlBorrarCurso`):
   ```ts
   urlObtenerAttachments: z.union([urlHttps, z.literal("")]),
   ```
2. En `defaultValues`, añadir `urlObtenerAttachments: "",`.
3. En el formulario (junto a los demás `<Field>`), añadir:
   ```tsx
   <Field label="AdminObtenerAttachments (opcional)" error={errors.urlObtenerAttachments?.message} {...register("urlObtenerAttachments")} />
   ```

### 3b.6 — IPC para descargar cualquier fichero (`electron/main.ts` + `electron/preload.ts`)
Ya existe `pdf:guardar` (pensado para PDFs). Para descargar también imágenes con su extensión,
añadir un handler genérico. En `electron/main.ts` (reusando los `dialog`/`fs` que ya importa):
```ts
ipcMain.handle("archivo:guardar", async (_e, { base64, fileName }: { base64: string; fileName: string }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: fileName });
  if (canceled || !filePath) return { success: false };
  await fs.promises.writeFile(filePath, Buffer.from(base64, "base64"));
  return { success: true, filePath };
});
```
En `electron/preload.ts`, dentro de `adminAPI` (p.ej. nuevo grupo `archivo` o junto a `pdf`):
```ts
  archivo: {
    guardar: (base64: string, fileName: string): Promise<{ success: boolean; filePath?: string }> =>
      ipcRenderer.invoke("archivo:guardar", { base64, fileName }),
  },
```
*(Alternativa rápida: reusar `window.adminAPI.pdf.guardar(base64, fileName)` si su
implementación respeta la extensión de `fileName`; si fuerza `.pdf`, usa el handler genérico.)*

### 3b.7 — `src/components/SolicitudDetail.tsx`: sección "Documentos adjuntos"
Es la ficha de detalle donde ya se muestra el PDF del formulario con `<PdfViewer>` (se usa el
hook `usePdf` en la línea ~188 y `<PdfViewer>` en ~708/~837/~1145). Añadir **cerca del visor
del PDF** una sección que liste los adjuntos.

1. Importar el hook: `import { usePdf, useAttachments, ... } from "../hooks/useSolicitudes";`
2. Obtener los adjuntos:
   ```tsx
   const attachmentsQuery = useAttachments(config, solicitud.rowId);
   const attachments = attachmentsQuery.data ?? [];
   ```
3. Helpers de visualización/descarga:
   ```tsx
   const descargarAdjunto = (a: Attachment) =>
     window.adminAPI.archivo.guardar(a.contentBase64, a.fileName); // o pdf.guardar
   const esImagen = (a: Attachment) => a.mimeType.startsWith("image/");
   const esPdf = (a: Attachment) => a.mimeType.includes("pdf");
   ```
4. UI (adapta clases/CSS vars al estilo del resto del componente):
   ```tsx
   {config.urlObtenerAttachments && (
     <section className="mt-4">
       <h3 className="text-sm font-semibold mb-2">Documentos adjuntos del solicitante</h3>
       {attachmentsQuery.isLoading && <p className="text-xs text-slate-500">Cargando adjuntos…</p>}
       {!attachmentsQuery.isLoading && attachments.length === 0 && (
         <p className="text-xs text-slate-500">Sin documentos adjuntos (matrícula antigua o sin Notas).</p>
       )}
       <ul className="space-y-2">
         {attachments.map((a) => (
           <li key={a.annotationId} className="flex items-center gap-2 border rounded-md px-3 py-2">
             <span className="text-sm truncate flex-1">{a.fileName}</span>
             <span className="text-xs text-slate-400">{a.mimeType}</span>
             {esPdf(a) && (
               <button type="button" onClick={() => window.adminAPI.pdf.openForPrint(a.contentBase64, a.fileName)}>Ver</button>
             )}
             {esImagen(a) && (
               <a href={`data:${a.mimeType};base64,${a.contentBase64}`} target="_blank" rel="noreferrer">Ver</a>
             )}
             <button type="button" onClick={() => descargarAdjunto(a)}>Descargar</button>
           </li>
         ))}
       </ul>
     </section>
   )}
   ```
   - **PDF:** "Ver" con `window.adminAPI.pdf.openForPrint(base64, fileName)` (visor nativo) o
     reutilizar `<PdfViewer contentBase64=... />` en un modal/expander.
   - **Imagen:** "Ver" abre la imagen con un data URL; o mostrar miniatura inline
     `<img src={`data:${a.mimeType};base64,${a.contentBase64}`} />`.
   - **Descargar:** `archivo.guardar` (o `pdf.guardar`).

> Opcional (mejora): caché local de adjuntos en `cursosStore` para no redescargar (como hace
> `usePdf` con `cursosStore.leerPdf`). No imprescindible para la primera versión.

---

## 4. Verificación end-to-end

1. **Flow** probado en aislado (sección 2) → devuelve las Notas de un `rowId` con adjuntos.
2. **Config:** abrir el modal de Conexión, pegar la URL de `AdminObtenerAttachments`, Guardar.
3. **App:** abrir una matrícula **reciente** (creada tras la Fase 1) con adjuntos → la sección
   "Documentos adjuntos" lista los ficheros; "Ver" y "Descargar" funcionan (probar con un PDF
   cifrado y una imagen HEIC/JPG).
4. Abrir una matrícula **antigua** → la sección sale vacía sin errores y el PDF de formulario
   se ve como siempre.
5. `npm run build` / `tsc` sin errores de tipos.

---

## 5. Resumen de archivos a tocar

| Archivo | Cambio |
|---|---|
| Power Automate | **Nuevo flow** `AdminObtenerAttachments` (List rows annotations + Response) |
| `electron/config-store.ts` | `urlObtenerAttachments?: string` en `AppConfig` |
| `src/api/types.ts` | `Attachment` + `ObtenerAttachmentsResponse` |
| `src/api/solicitudes.ts` | `DataverseAnnotation` + `obtenerAttachments()` |
| `src/hooks/useSolicitudes.ts` | key + `useAttachments()` |
| `src/components/modals/ConexionModal.tsx` | campo + zod + defaultValues |
| `electron/main.ts` + `electron/preload.ts` | IPC `archivo:guardar` (o reusar `pdf.guardar`) |
| `src/components/SolicitudDetail.tsx` | sección UI "Documentos adjuntos" |

## 6. Referencia: el flow público que generó las Notas (contexto)
En `G:\Dev\Matriculación-digital\docs\flow-subir-adjunto.md` está la receta del flow
`PublicSubirAdjunto` (crear Nota + relacionar con la matrícula vía `cpmmr_matricula_Annotations`,
con `item/@odata.id` = URI **absoluta** base **v9.1**). Útil si necesitas entender o replicar el
lado de escritura.
