# Plantilla HTML para PDF de Matrícula — CPM "Marcos Redondo"

## Índice

1. [Descripción general](#1-descripción-general)
2. [Estructura de archivos](#2-estructura-de-archivos)
3. [Mapa de campos](#3-mapa-de-campos)
4. [Diseño y maquetación](#4-diseño-y-maquetación)
5. [Cómo rellenar los datos](#5-cómo-rellenar-los-datos)
6. [Exportación a PDF](#6-exportación-a-pdf)
7. [Integración en otra aplicación](#7-integración-en-otra-aplicación)
8. [Referencia visual de cada sección](#8-referencia-visual-de-cada-sección)
9. [Preguntas frecuentes](#9-preguntas-frecuentes)

---

## 1. Descripción general

Existen dos plantillas HTML independientes que replican exactamente la estructura de los PDFs generados por la aplicación React original:

| Archivo | Contenido |
|---------|-----------|
| `plantilla-solicitud.html` | Solicitud de Matrícula (1 página A4) |
| `plantilla-ampliacion.html` | Ampliación de Matrícula (1 página A4) |

Ambas están diseñadas para:
- Imprimirse o exportarse a PDF desde cualquier navegador
- Ser rellenadas mediante **búsqueda y reemplazo de texto** desde cualquier lenguaje de programación
- Usar CSS puro con `@page` para formateo A4 preciso
- Incluir los logotipos oficiales embebidos en base64 (sin dependencias externas)

---

## 2. Estructura de archivos

### 2.1 Composición HTML

```
plantilla-solicitud.html
├── <head>
│   ├── <style>
│   │   ├── @page (tamaño A4, márgenes cero)
│   │   ├── body (fondo gris en pantalla, blanco en impresión)
│   │   ├── .page (210mm × 297mm)
│   │   ├── .card (tarjetas blancas con bordes redondeados)
│   │   ├── .field-label / .field-value (pares etiqueta/valor)
│   │   ├── .section-title (títulos de sección)
│   │   ├── .desglose (tabla de desglose de tasas)
│   │   ├── .subject-grid / .subject-row (lista de asignaturas)
│   │   ├── .footer (pie de página absoluto)
│   │   └── .orange-num / .orange-badge (elementos naranja)
│   │   └── @media print (oculta fondo de pantalla)
│   └── </style>
├── <body>
│   └── <div class="page">        ← Página A4 única
│       ├── Header (3 columnas)   ← Logos + Título + nOrden/timestamp
│       ├── Fila 1                ← Dos columnas
│       │   ├── Columna izq. (flex: 3)
│       │   │   ├── Datos Personales
│       │   │   └── Menores de 18
│       │   └── Columna der. (flex: 1.4)
│       │       └── Forma de Pago + Desglose + Importes
│       ├── Fila 2                ← Ancho completo
│       │   └── Datos de Matriculación + Asignaturas + Convalidación
│       └── Footer                ← Absoluto, pegado al fondo
└── </html>
```

```
plantilla-ampliacion.html
├── <head> (mismo CSS)
├── <body>
│   └── <div class="page">
│       ├── Header (misma estructura)
│       ├── Fila 1
│       │   ├── Columna izq.: Datos Personales (sin Menores)
│       │   └── Columna der.: Datos de Matrícula (resumen)
│       ├── Asignaturas Matriculadas (lista completa con badges)
│       ├── Firmas (alumno + secretaría)
│       └── Footer
└── </html>
```

### 2.2 Sistema de colores (paleta exacta)

Tomada directamente del código React original (`MatriculaPdf.tsx`):

| Variable | Color | Uso |
|----------|-------|-----|
| `#F5F5F5` | Gris claro | Fondo de página |
| `#FFFFFF` | Blanco | Fondos de tarjetas |
| `#F9FAFB` | Gris muy claro | Fondos de campos de valor |
| `#F3F4F6` | Gris borde | Bordes de tarjetas |
| `#E5E7EB` | Gris separador | Líneas divisorias |
| `#9CA3AF` | Gris etiqueta | Texto de etiquetas (labels) |
| `#6B7280` | Gris medio | Textos secundarios |
| `#374151` | Gris oscuro | Textos de cuerpo |
| `#1F2937` | Gris casi negro | Valores de campos |
| `#111827` | Negro | Títulos, badges |
| `#EFF6FF` | Azul muy claro | Fondos de listas de asignaturas |
| `#BFDBFE` | Azul claro | Bordes de asignaturas "Matriculada" |
| `#1D4ED8` | Azul | Códigos de asignatura "Matriculada" |
| `#1E40AF` | Azul oscuro | Títulos de lista de asignaturas |
| `#FAF5FF` | Púrpura muy claro | Fondo asignatura "Perfil" |
| `#F3E8FF` | Púrpura claro | Fondo código "Perfil" |
| `#E9D5FF` | Púrpura borde | Borde asignatura "Perfil" |
| `#7E22CE` | Púrpura | Código/badge "Perfil" |
| `#FFF7ED` | Naranja muy claro | Fondo asignatura "Pendiente" |
| `#FED7AA` | Naranja claro | Borde asignatura "Pendiente" |
| `#92400E` | Naranja oscuro | Código/badge "Pendiente" |
| `#F0FDF4` | Verde muy claro | Fondo convalidación |
| `#DCFCE7` | Verde claro | Fondo código "Convalidada" |
| `#BBF7D0` | Verde borde | Borde asignatura "Convalidada" |
| `#15803D` | Verde | Código descuento "Convalidada" |
| `#166534` | Verde oscuro | Título "SOLICITA:" |
| `#F97316` | Naranja | Número de orden, timestamp |

---

## 3. Mapa de campos

### 3.1 Solicitud de Matrícula (`plantilla-solicitud.html`)

Cada campo de datos está contenido en un par `.field-label` / `.field-value`. Para rellenar, busca el texto de la etiqueta y reemplaza el contenido del `div` hermano `.field-value`.

#### Header

| Etiqueta | Selector / referencia | Ejemplo de valor |
|----------|----------------------|------------------|
| Título del documento | Texto fijo | "Solicitud de Matrícula" |
| Curso académico | `div.card div` central, segundo `div` | "Curso Académico 2025 / 2026" |
| Nombre del centro | `div.card div` central, tercer `div` | "C.P.M. \"Marcos Redondo\", Ciudad Real" |
| Nº de orden (nOrden) | `div.orange-num` | `#42` |
| Curso corto (junto a nOrden) | `div` con `color:#F97316; font-size:8px` | "Curso 25/26" |
| Timestamp envío | `span` dentro de `div.orange-badge` | "Enviado: 01/06/2026 14:30" |

#### Datos Personales

| Etiqueta (`field-label`) | Campo | Ruta aproximada |
|---------------------------|-------|-----------------|
| NOMBRE | `field-value` | 1er `.card` > 1er `.flex-row` > 1er `div.flex-1` |
| APELLIDOS | `field-value` | 1er `.card` > 1er `.flex-row` > 2º `div.flex-1-4` |
| D.N.I. / N.I.E. | `field-value` | 1er `.card` > 2º `.flex-row` > 1er `div.flex-1` |
| FECHA DE NAC. | `field-value` | 1er `.card` > 2º `.flex-row` > 2º `div.flex-1` |
| DOMICILIO ACTUAL | `field-value` | 1er `.card` > 2º `.flex-row` > 3er `div.flex-1-8` |
| LOCALIDAD | `field-value` | 1er `.card` > 3er `.flex-row` > 1er `div.flex-1-8` |
| PROVINCIA | `field-value` | 1er `.card` > 3er `.flex-row` > 2º `div.flex-1` |
| C.P. | `field-value` | 1er `.card` > 3er `.flex-row` > 3er `div.flex-0-8` |
| CORREO ELECTRÓNICO | `field-value` | 1er `.card` > 4º `.flex-row` > 1er `div.flex-1-8` |
| TELÉFONO | `field-value` | 1er `.card` > 4º `.flex-row` > 2º `div.flex-1` |

#### Radios / Checks (Datos Personales)

| Grupo | Opciones | Selector |
|-------|----------|----------|
| Hora salida | `<17 h`, `17 h`, `18 h` | 3 elementos `.dot-filled` / `.dot-empty` dentro del `radio-row` "HORA SALIDA" |
| Disponib. mañana | Sí / No | 2 elementos `.box-filled` / `.box-empty` dentro del `radio-row` "DISPONIB. MAÑANA" |
| Autorización imagen | Sí / No | 2 elementos `.box-filled` / `.box-empty` dentro del `radio-row` "AUTORIZACIÓN IMAGEN" |

Para seleccionar una opción, cambia la clase:
- `dot-filled` → seleccionado, `dot-empty` → no seleccionado
- `box-filled` → seleccionado, `box-empty` → no seleccionado

La clase se aplica al `<span>` que representa el círculo/cuadrado.

#### Menores de 18

Se muestra condicionalmente si hay datos de tutor. La sección completa es el segundo `.card` en la columna izquierda.

| Etiqueta | Campo |
|----------|-------|
| TUTOR/A LEGAL 1 (APELLIDOS Y NOMBRE) | `field-value` (flex:3) |
| D.N.I. (tutor 1) | `field-value` (flex:1) |
| TUTOR/A LEGAL 2 (APELLIDOS Y NOMBRE) | `field-value` (flex:3) |
| D.N.I. (tutor 2) | `field-value` (flex:1) |

#### Forma de Pago

| Campo | Selector |
|-------|----------|
| Modalidad de pago | Primer `.card` en columna derecha > `field-value` |
| Importe Total (EUR) | `field-value-highlight` (negra, 11px) |
| 1er Pago (EUR) | Tercer `field-value` (solo en fraccionado) |
| 2o Pago (EUR) | Cuarto `field-value` (solo en fraccionado) |

**Modalidades de pago:**
- `unico` → "Pago Único"
- `fraccionado` → "Pago Fraccionado"
- `beca` → "Solicita Beca"

#### Desglose de Tasas

Dentro del `div.desglose`, cada fila es un `div.desglose-row` con dos `<span>`:
- Primero: nombre del concepto
- Segundo: importe con "EUR"

| Concepto | Descripción |
|----------|-------------|
| Servicios Generales | Coste fijo (10,00 EUR) |
| Apertura de Expediente | 25,00 EUR (solo 1er año) |
| Matrícula Curso (Nº) | Según curso y enseñanza |
| Asignaturas Pendientes | Coste adicional |
| Matrícula de Honor (Art. 13) | Descuento (verde, con clase `.discount`) |
| Reducción aplicada | Porcentaje de reducción (verde) |

Las filas con descuento llevan la clase adicional `.discount` y están precedidas por un `div.divider-row`.

#### Datos de Matriculación

| Etiqueta | Campo |
|----------|-------|
| TIPO DE ENSEÑANZA | `field-value` (flex:1.6) |
| CURSO | `field-value` (width:42px) |
| ESPECIALIDAD | `field-value` (flex:1.4) |
| REPETIDOR | Badge negro con texto "SI" (o vacío) |
| PERFIL ELEGIDO | Badge negro con texto del perfil (o vacío) |

#### Lista de Asignaturas

Dentro del `div.subject-grid`, cada asignatura es un `div.subject-row`:

| Elemento | Clase | Descripción |
|----------|-------|-------------|
| Código | `span.subject-code` | Ej: "P01", "H01" |
| Nombre | `span.subject-name` | Ej: "Piano" |
| Badge | `span.badge-sm` | Texto según tipo |

**Tipos de asignatura y sus estilos:**

| Tipo | bg | border | code color | code bg | badge color | badge bg | badge border |
|------|----|--------|------------|---------|-------------|----------|-------------|
| Matriculada | `#fff` | `#BFDBFE` | `#1D4ED8` | `#EFF6FF` | `#1D4ED8` | `#EFF6FF` | `#BFDBFE` |
| Perfil | `#FAF5FF` | `#E9D5FF` | `#7E22CE` | `#F3E8FF` | `#7E22CE` | `#F3E8FF` | `#E9D5FF` |
| Pendiente | `#FFF7ED` | `#FED7AA` | `#92400E` | `#FFF7ED` | `#92400E` | `#FFF7ED` | `#FED7AA` |

Los grupos de asignaturas se separan con `div.group-sep` (línea azul fina).

#### Convalidación

Dentro del `div.convalidacion-box`:

| Elemento | Descripción |
|----------|-------------|
| `h3` con "SOLICITA:" | Título fijo |
| `p` | Texto explicativo con el motivo entre comillas |
| `div.subject-row` (fondo blanco, borde verde) | Asignaturas a convalidar |

Cada asignatura de convalidación tiene:
- `span.subject-code` con `color:#15803D; background:#DCFCE7`
- `span.subject-name`

#### Footer (institucional, datos fijos)

| Línea | Contenido |
|-------|-----------|
| 1 | "Consejería de Educación, Cultura y Deportes" |
| 2 | "Conservatorio Profesional de Música \"Marcos Redondo\"" |
| 3 | "Calle Pantano del Vicario, 1 — 13004 Ciudad Real" |
| 4 | "926 274 154" |
| 5 | "13004341.cpm@educastillalamancha.es" |
| 6 | "www.conservatoriociudadreal.es" |

---

### 3.2 Ampliación de Matrícula (`plantilla-ampliacion.html`)

#### Datos Personales (columna izquierda)

Mismos campos que la Solicitud, pero sin la sección de Menores.

#### Datos de Matrícula (columna derecha)

| Campo | `field-value` |
|-------|---------------|
| Enseñanza / Curso | Ej: "Enseñanza Profesional — 4º" |
| Especialidad | Texto libre |
| Forma de Pago | Mismas opciones que en Solicitud |
| Reducción de Tasas | Ver valores posibles en sección 3.3 |

#### Radios / Checks (misma mecánica que Solicitud)

#### Asignaturas Matriculadas

Los mismos 4 tipos que en Solicitud, más un tipo adicional:

| Tipo | Color code | Badge |
|------|-----------|-------|
| Matriculada | Azul | "Matriculada" |
| Perfil | Púrpura | "Perfil" |
| Pendiente | Naranja | "Pendiente" |
| Convalidada | Verde | "Convalidada" |

#### Firmas

Dos columnas:
- Izquierda: línea + "Firma del/la Alumno/a"
- Derecha: línea + "Sello y firma de Secretaría" + fecha

Debajo, el nombre completo del alumno/a.

---

### 3.3 Valores posibles para campos controlados

#### `tipoEnsenanza`
| Valor | Texto a mostrar |
|-------|----------------|
| `elemental` | "Enseñanza Elemental" |
| `profesional` | "Enseñanza Profesional" |

#### `formaPago`
| Valor | Texto a mostrar |
|-------|----------------|
| `unico` | "Pago Único" |
| `fraccionado` | "Pago Fraccionado" |
| `beca` | "Solicita Beca" |

#### `tipoReduccion`
| Valor | Texto a mostrar |
|-------|----------------|
| `ninguna` | "Ninguna" |
| `fam_num_general` | "Familia Numerosa General" |
| `fam_num_especial` | "Familia Numerosa Especial" |
| `discapacidad` | "Discapacidad" |
| `terrorismo` | "Víctima de Terrorismo" |
| `violencia_genero` | "Violencia de Género" |
| `ingreso_minimo` | "Ingreso Mínimo de Solidaridad" |

#### Perfiles (5º y 6º Profesional)
| Perfil | Texto 5º | Texto 6º |
|--------|----------|----------|
| A | "Perfil A — Fundamentos de Composición" | "Perfil A — Fundamentos de Composición" |
| B | "Perfil B — Improvisación / Informática Musical" | "Perfil B — Didáctica musical / Improvisación" |
| C | "Perfil C — Improvisación / Coro 1" | "Perfil C — Música moderna / Coro 2" |

#### `convalidacionMotivo`
| Valor | Texto |
|-------|-------|
| `doble` | "Convalidación por doble especialidad o similar" |
| `eso_bach` | "Asignaturas de ESO y Bachillerato" |

#### `horaSalidaEstudios`
| Valor | Texto |
|-------|-------|
| `Antes de las 17 h` | `<17 h` |
| `17 h` | `17 h` |
| `18 h` | `18 h` |

---

## 4. Diseño y maquetación

### 4.1 Tamaño de página

```css
@page { size: A4; margin: 0; }
.page {
  width: 210mm;
  min-height: 297mm;
  background: #F5F5F5;
  padding: 20px;
}
```

El padding de 20px en la página deja ≈ 20mm de margen. Si se necesita más/menos espacio vertical, ajusta `min-height`.

### 4.2 Impresión

```css
@media print {
  body { background: none; padding: 0; }
  .page { box-shadow: none; margin: 0; page-break-after: always; }
}
```

Al imprimir, se elimina el fondo gris del body y las sombras.

### 4.3 Disposición flex

El layout usa flexbox de CSS. Las proporciones clave:

- **Header**: 3 columnas con `justify-content: space-between`
- **Fila 1**: `flex-direction: row` con columnas en proporción 3:1.4
- **Fila 2**: ancho completo (`card`)
- **Campos**: `flex-direction: row` con proporciones variables (1, 1.4, 1.8, 0.8, etc.)
- **Footer**: `position: absolute; bottom: 20px; left: 20px; right: 20px`

### 4.4 Sistema de tipografía

| Elemento | Font-size | Font-weight | Color |
|----------|-----------|-------------|-------|
| Título header (Solicitud/Ampliación) | 13px | 700 | `#111827` |
| Curso académico | 9px | 400 | `#6B7280` |
| Centro | 8px | 400 | `#9CA3AF` |
| Section title | 7px | 700 | `#6B7280` |
| Field label | 6.5px | 700 | `#9CA3AF` |
| Field value | 9px | 400 | `#1F2937` |
| Field value (highlight) | 11px | 700 | `#1F2937` |
| Nº orden (nOrden) | 22px | 700 | `#F97316` |
| Badge (asignatura) | 6px | 700 | (según tipo) |
| Código asignatura | 6.5px | 700 | (según tipo) |
| Nombre asignatura | 8px | 400 | `#374151` |
| Footer | 7px | 400/700 | `#374151` / `#6B7280` |

### 4.5 Tarjetas (cards)

```css
.card {
  background: #fff;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 6px;
  border: 1px solid #F3F4F6;
}
.section-title {
  font-size: 7px; font-weight: 700; color: #6B7280;
  text-transform: uppercase; letter-spacing: 0.8px;
  margin-bottom: 6px; padding-bottom: 4px;
  border-bottom: 1px solid #F3F4F6;
}
```

---

## 5. Cómo rellenar los datos

### 5.1 Método manual (edición HTML)

Busca el `field-label` con el texto deseado y reemplaza el contenido del `field-value` hermano:

```html
<div class="field-label">Nombre</div>
<div class="field-value">María García</div>
<!-- Reemplazar "María García" por el valor deseado -->
```

Para nOrden:
```html
<div class="orange-num">#42</div>
<!-- Reemplazar "#42" por "#" + número -->
```

Para el timestamp:
```html
<span>Enviado: 01/06/2026 14:30</span>
```

Para radios/checks, cambia la clase CSS:
```html
<span class="dot-filled"> → seleccionado
<span class="dot-empty"> → no seleccionado
```

### 5.2 Método programático (búsqueda y reemplazo)

Desde cualquier lenguaje (Python, Node.js, PHP, Java, C#, etc.):

**Ejemplo en Node.js:**
```js
const fs = require('fs');
let html = fs.readFileSync('plantilla-solicitud.html', 'utf8');

// 1. Datos personales
html = html.replace(
  /(?<=<div class="field-label">Nombre<\/div>\s*<div class="field-value">).*?(?=<\/div>)/,
  'María García López'
);
html = html.replace(
  /(?<=<div class="field-label">D\.N\.I\. \/ N\.I\.E\.<\/div>\s*<div class="field-value">).*?(?=<\/div>)/,
  '12345678Z'
);

// 2. nOrden
html = html.replace(
  /<div class="orange-num"[^>]*>.*?<\/div>/,
  '<div class="orange-num">#42</div>'
);

// 3. Timestamp
html = html.replace(
  /(?<=Enviado: ).*?(?=<\/span>)/,
  '01/06/2026 14:30'
);

// 4. Seleccionar radio (hora salida)
html = html.replace(
  /<span class="dot-empty"><\/span>\s*<label>&lt;17 h<\/label>/,
  '<span class="dot-filled"></span><label>&lt;17 h</label>'
);

// 5. Asignaturas (reemplazar toda la lista)
html = html.replace(
  /<div class="subject-grid">[\s\S]*?<\/div>\s*<\/div>/,
  generarListaAsignaturas(misAsignaturas)
);

// 6. Desglose de tasas
html = html.replace(
  /<div class="desglose">[\s\S]*?<\/div>/,
  generarDesglose(miCalculo)
);

fs.writeFileSync('output.html', html, 'utf8');
```

**Ejemplo en Python:**
```python
import re

with open('plantilla-solicitud.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Rellenar campo
html = re.sub(
    r'(?<=<div class="field-label">Nombre</div>\s*<div class="field-value">).*?(?=</div>)',
    'María García López',
    html
)

# nOrden
html = re.sub(
    r'<div class="orange-num"[^>]*>.*?</div>',
    '<div class="orange-num">#42</div>',
    html
)

with open('output.html', 'w', encoding='utf-8') as f:
    f.write(html)
```

### 5.3 Consideraciones importantes

1. **Escapado HTML**: Los valores con caracteres especiales deben escaparse: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, acentos y ñ se pueden usar directamente (UTF-8).

2. **Logos**: Ya están embebidos en base64. Si cambian los archivos de logo, hay que regenerar el base64:
   ```bash
   # En bash/PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("ruta/al/logo.png"))
   ```
   Luego reemplazar el `src="data:image/png;base64,..."` con el nuevo valor.

3. **Saltos de línea en campos**: No uses `<br>` dentro de `field-value`. Si un campo necesita múltiples líneas, usa un padding mayor o permite que el texto fluya naturalmente.

4. **Condicionales**: Algunas secciones deben ocultarse si no hay datos:
   - **Menores de 18**: Si no hay tutores, elimina o comenta el `<div class="card">` de menores.
   - **Desglose**: Si no hay cálculo, elimina el `div.desglose`.
   - **Convalidación**: Si no hay, elimina el `div.convalidacion-box`.
   - **Repetidor/Perfil**: Si no aplica, borra el badge correspondiente.

---

## 6. Exportación a PDF

### 6.1 Desde navegador

1. Abre el archivo HTML en cualquier navegador (Chrome, Firefox, Edge)
2. `Ctrl+P` (o menú → Imprimir)
3. Selecciona "Guardar como PDF" como destino
4. Configura:
   - Tamaño: **A4**
   - Márgenes: **Ninguno** (el CSS ya maneja los márgenes)
   - Escala: **100** (predeterminado)
   - Opciones: marca "Gráficos de fondo" para ver los colores
5. Guarda el PDF

### 6.2 Programáticamente (Node.js con Puppeteer)

```js
const puppeteer = require('puppeteer');

async function htmlToPdf(htmlPath, pdfPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Cargar HTML
  await page.goto(`file://${__dirname}/${htmlPath}`, {
    waitUntil: 'networkidle0'
  });
  
  // Generar PDF
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
  });
  
  await browser.close();
}

// Uso
htmlToPdf('output.html', 'solicitud-matricula.pdf');
```

### 6.3 Programáticamente (Python con weasyprint)

```python
import weasyprint

html_path = 'output.html'
pdf_path = 'solicitud-matricula.pdf'

doc = weasyprint.HTML(filename=html_path).render()
doc.write_pdf(pdf_path)
```

### 6.4 Programáticamente (Python con playwright)

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f"file://{html_path}")
    page.pdf(path=pdf_path, format='A4', margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'}, print_background=True)
    browser.close()
```

---

## 7. Integración en otra aplicación

### 7.1 Flujo de trabajo recomendado

```
Datos de la aplicación (JSON, DB, API)
        │
        ▼
Cargar plantilla HTML como string
        │
        ▼
Reemplazar marcadores/campos con datos reales
        │
        ▼
Exportar a PDF (navegador, Puppeteer, Playwright, weasyprint)
        │
        ▼
Enviar PDF al usuario o almacenarlo
```

### 7.2 Ejemplo completo (Node.js)

```js
const fs = require('fs');
const puppeteer = require('puppeteer');

async function generarSolicitud(datos) {
  let template = fs.readFileSync('plantilla-solicitud.html', 'utf8');
  
  // Mapeo de campos
  const campos = {
    'NOMBRE': datos.nombre,
    'APELLIDOS': datos.apellidos,
    'D\\.N\\.I\\. \\/ N\\.I\\.E\\.': datos.dni,
    'FECHA DE NAC\\.': datos.fechaNacimiento,
    'DOMICILIO ACTUAL': datos.domicilio,
    'LOCALIDAD': datos.localidad,
    'PROVINCIA': datos.provincia,
    'C\\.P\\.': datos.codigoPostal,
    'CORREO ELECTRÓNICO': datos.email,
    'TELÉFONO': datos.telefono,
  };
  
  for (const [label, value] of Object.entries(campos)) {
    const regex = new RegExp(
      `(?<=<div class="field-label">${label}<\\/div>\\s*<div class="field-value">).*?(?=<\\/div>)`,
      's'
    );
    template = template.replace(regex, value || '');
  }
  
  // nOrden
  if (datos.nOrden) {
    template = template.replace(
      /<div class="orange-num"[^>]*>.*?<\/div>/,
      `<div class="orange-num">#${datos.nOrden}</div>`
    );
  }
  
  // Curso corto
  if (datos.cursoCorto) {
    template = template.replace(
      /<div style="font-size:8px; color:#F97316; margin-top:1px;">.*?<\/div>/,
      `<div style="font-size:8px; color:#F97316; margin-top:1px;">Curso ${datos.cursoCorto}</div>`
    );
  }
  
  // Timestamp
  if (datos.timestamp) {
    template = template.replace(
      /(?<=Enviado: ).*?(?=<\/span>)/,
      datos.timestamp
    );
  }
  
  // Exportar a PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(template, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: 'solicitud.pdf',
    format: 'A4',
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
  });
  await browser.close();
}
```

### 7.3 Ejemplo completo (Python)

```python
import re
import json
from playwright.sync_api import sync_playwright

def generar_solicitud(datos: dict, output_path: str):
    with open('plantilla-solicitud.html', 'r', encoding='utf-8') as f:
        template = f.read()

    # Rellenar campos
    campos = {
        'NOMBRE': datos.get('nombre', ''),
        'APELLIDOS': datos.get('apellidos', ''),
        r'D\.N\.I\. \/ N\.I\.E\.': datos.get('dni', ''),
        'FECHA DE NAC\.': datos.get('fechaNacimiento', ''),
        'DOMICILIO ACTUAL': datos.get('domicilio', ''),
        'LOCALIDAD': datos.get('localidad', ''),
        'PROVINCIA': datos.get('provincia', ''),
        r'C\.P\.': datos.get('codigoPostal', ''),
        'CORREO ELECTRÓNICO': datos.get('email', ''),
        'TELÉFONO': datos.get('telefono', ''),
    }

    def escape_regex(s):
        s = s.replace(' ', '\\s*')
        s = s.replace('.', '\\.')
        return s

    for label, value in campos.items():
        pattern = re.compile(
            rf'(?<=<div class="field-label">{label}</div>\s*<div class="field-value">).*?(?=</div>)',
            re.DOTALL
        )
        template = pattern.sub(value or '', template)

    # nOrden
    if datos.get('nOrden'):
        template = re.sub(
            r'<div class="orange-num"[^>]*>.*?</div>',
            f'<div class="orange-num">#{datos["nOrden"]}</div>',
            template
        )

    # Timestamp
    if datos.get('timestamp'):
        template = re.sub(
            r'(?<=Enviado: ).*?(?=</span>)',
            datos['timestamp'],
            template
        )

    # Exportar a PDF
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(template, wait_until='networkidle0')
        page.pdf(path=output_path, format='A4',
                 margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'},
                 print_background=True)
        browser.close()

# Uso
datos = {
    "nombre": "María",
    "apellidos": "García López",
    "dni": "12345678Z",
    "fechaNacimiento": "15/03/2008",
    "domicilio": "C/ Calatrava, 25",
    "localidad": "Ciudad Real",
    "provincia": "Ciudad Real",
    "codigoPostal": "13001",
    "email": "maria@email.com",
    "telefono": "600 123 456",
    "nOrden": 42,
    "timestamp": "01/06/2026 14:30"
}
generar_solicitud(datos, 'solicitud.pdf')
```

---

## 8. Referencia visual de cada sección

### 8.1 Solicitud de Matrícula

```
┌─────────────────────────────────────────────────────┐
│ [JCCM]       Solicitud de Matrícula          [CPM]  │
│           Curso Académico 2025 / 2026         #42    │
│        C.P.M. "Marcos Redondo"           Curso 25/26│
│                                          ┌─────────┐│
│                                          │Enviado: ││
│                                          │01/06... ││
│                                          └─────────┘│
├──────────────────────┬──────────────────────────────┤
│ DATOS PERSONALES     │   FORMA DE PAGO              │
│ Nombre: María        │   Modalidad: Fraccionado     │
│ Apellidos: García    │                              │
│ DNI: 12345678Z       │   ┌─── DESGLOSE ───┐        │
│ Fecha nac: 15/03/08  │   │ Serv. Grales... │        │
│ Domicilio: C/...     │   │ Apertura...     │        │
│ Localidad: CR        │   │ Matrícula...    │        │
│ Provincia: CR        │   │ Pendientes...   │        │
│ CP: 13001            │   │ Descuentos...   │        │
│ Email: maria@...     │   └────────────────┘        │
│ Tel: 600 123 456     │                              │
│                       │   Importe Total: 220,50 EUR  │
│ Hora salida: ●<17 ○17│   1er Pago: 132,30 EUR       │
│ Disponib: ●Sí ○No    │   2o Pago: 88,20 EUR         │
│ Autorización: ●Sí ○No│                              │
│──────────────────────┤                              │
│ MENORES DE 18        │                              │
│ Tutor 1: García M.   │                              │
│ DNI: 87654321A       │                              │
├──────────────────────┴──────────────────────────────┤
│ DATOS DE MATRICULACIÓN                              │
│ Enseñanza: Profesional   Curso: 3º                  │
│ Especialidad: Piano      Repetidor: [SI]            │
│ Perfil: [Perfil B — Improv / Informática]           │
│                                                      │
│ ┌── ASIGNATURAS ──────────────────────────────────┐ │
│ │ P01  Piano                              [Matr] │ │
│ │ H01  Historia de la Música             [Matr] │ │
│ │ ───────────────────────────────────────────────│ │
│ │ FC01 Fundamentos de Composición       [Perfil] │ │
│ │ ───────────────────────────────────────────────│ │
│ │ A28  Armonía (2º)                    [Pendte] │ │
│ └──────────────────────────────────────────────────│
│                                                      │
│ ┌── SOLICITA: ───────────────────────────────────┐ │
│ │ Convalidación de asignaturas de ESO y           │ │
│ │ Bachillerato:                                   │ │
│ │ LM01  Lenguaje Musical I                       │ │
│ │ CP01  Coro I                                   │ │
│ └──────────────────────────────────────────────────│
├────────────────────────────────────────────────────┤
│ Consejería de Educación              926 274 154  │
│ CPM "Marcos Redondo"              13004341@...   │
│ Calle Pantano del Vicario, 1     www.conse...    │
│ 13004 Ciudad Real                                  │
└────────────────────────────────────────────────────┘
```

### 8.2 Ampliación de Matrícula

```
┌──────────────────────────────────────────────────────┐
│ [JCCM]   AMPLIACIÓN DE MATRÍCULA           [CPM]    │
│           Curso Académico 2025 / 2026        #87     │
│        C.P.M. "Marcos Redondo"           Curso 25/26│
│                                           ┌────────┐│
│                                           │Enviado:││
│                                           │15:45   ││
│                                           └────────┘│
├──────────────────────┬──────────────────────────────┤
│ DATOS PERSONALES     │   DATOS DE MATRÍCULA         │
│ Nombre: Carlos       │   Enseñanza/Curso: Prof. 4º  │
│ Apellidos: Sánchez   │   Especialidad: Clarinete    │
│ DNI: 87654321B       │   Forma de Pago: Único       │
│ Fecha nac: 22/11/07  │   Reducción: Fam. Numerosa   │
│ Email: carlos@...    │                              │
│ Tel: 650 987 654     │   Hora salida: ○<17 ●17 ○18 │
│ Domicilio: Avda...   │   Disponib: ●Sí ○No          │
│ Localidad: Miguelturra│  Autorización: ●Sí ○No      │
│ Provincia: CR        │                              │
│ CP: 13170            │                              │
├──────────────────────┴──────────────────────────────┤
│ ASIGNATURAS MATRICULADAS (5)                         │
│ ┌──────────────────────────────────────────────────┐│
│ │ CL01  Clarinete                         [Matr.] ││
│ │ IM01  Improvisación                     [Perfil] ││
│ │ A28   Armonía (pend. 3º)              [Pendte.] ││
│ │ LM02  Lenguaje Musical II            [Conval.]  ││
│ └──────────────────────────────────────────────────││
├──────────────────────────────────────────────────────┤
│                       ───────                        │
│               Firma del/la Alumno/a                 │
│                       ───────                        │
│        Sello y firma de Secretaría                  │
│            Ciudad Real, 01/06/2026                  │
│                                                      │
│              Carlos Sánchez Martínez                 │
├──────────────────────────────────────────────────────┤
│ [Mismo footer institucional]                         │
└──────────────────────────────────────────────────────┘
```

---

## 9. Preguntas frecuentes

### ¿Puedo añadir más campos?

Sí. Duplica la estructura de un campo existente:
```html
<div style="flex:1;">
  <div class="field-label">Mi Nuevo Campo</div>
  <div class="field-value"></div>
</div>
```
Ajusta `flex:` según el ancho deseado. Si se acaba el espacio horizontal, añade un nuevo `.flex-row`.

### ¿Cómo manejo el desglose de tasas dinámico?

Reemplaza todo el `div.desglose`:
```html
<div class="desglose">
  <div class="desglose-title">Desglose de Tasas</div>
  <div class="desglose-row"><span>Servicios Generales</span><span>10,00 EUR</span></div>
  <!-- Más filas... -->
</div>
```
Para filas de descuento, añade la clase `discount`:
```html
<div class="desglose-row discount"><span>Matrícula de Honor</span><span>-58,00 EUR</span></div>
```
Para separadores entre secciones: `<div class="divider-row"></div>`.

### ¿Cómo manejo la lista de asignaturas?

Reemplaza todo el contenido de `div.subject-grid`:
```html
<div class="subject-grid">
  <div class="subject-grid-title">Asignaturas:</div>
  <div>
    <div class="subject-row" style="background:#fff; border-color:#BFDBFE;">
      <span class="subject-code" style="color:#1D4ED8; background:#EFF6FF;">P01</span>
      <span class="subject-name">Piano</span>
      <span class="badge-sm" style="color:#1D4ED8; background:#EFF6FF; border:1px solid #BFDBFE;">Matriculada</span>
    </div>
    <!-- Más asignaturas aquí -->
  </div>
</div>
```

### ¿Cómo selecciono un radio button?

Busca el grupo de radios por su etiqueta (`Hora salida`, `Disponib.`, etc.) y cambia las clases:
- `<span class="dot-filled">` → seleccionado (relleno)
- `<span class="dot-empty">` → no seleccionado (vacío)

Ejemplo: para marcar "17 h" como seleccionado:
```html
<span class="dot-empty"></span><label>&lt;17 h</label>   <!-- no seleccionado -->
<span class="dot-filled"></span><label>17 h</label>       <!-- seleccionado -->
<span class="dot-empty"></span><label>18 h</label>        <!-- no seleccionado -->
```

### ¿Qué navegadores son compatibles?

Cualquier navegador moderno: Chrome 90+, Firefox 90+, Edge 90+, Safari 14+. La exportación a PDF funciona mejor desde Chrome/Edge.

### ¿Puedo cambiar los logotipos?

Sí. Los logos están en formato base64 embebido. Para cambiarlos:
1. Convierte la nueva imagen a base64
2. Busca en el HTML `src="data:image/png;base64,..."` y reemplázalo
3. Ajusta el atributo `style="height:30px;"` si es necesario

### ¿La plantilla soporta acentos y caracteres especiales?

Sí. El archivo está en UTF-8 y los acentos se usan directamente (á, é, í, ó, ú, ü, ñ, ¿, ¡). Si generas el HTML desde otro sistema, asegúrate de especificar `<meta charset="UTF-8">`.

### ¿Puedo usar la plantilla sin conexión a internet?

Sí. No hay dependencias externas (CDN, web fonts, etc.). Todo está autocontenido: CSS, imágenes, y estructura HTML.

### ¿Cómo hago que el PDF ocupe exactamente 1 página?

Si los datos son extensos y el contenido se desborda:
- Reduce el `padding` de `.page` (actualmente 20px)
- Reduce los `padding` de `.card` (actualmente 10px)
- Reduce el `font-size` de los valores (actualmente 9px)
- Reduce el gap entre secciones (`margin-bottom: 6px` en `.card`)
- Si es necesario, usa `font-size: 8px` globalmente

Si el contenido es escaso y no llega al fondo:
- Aumenta los paddings o márgenes
- O usa `min-height: 297mm` que ya fuerza al menos una página A4
