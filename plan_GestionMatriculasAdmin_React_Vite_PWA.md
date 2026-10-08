# Plan de migración: GestionMatriculasAdmin → React + Vite + PWA

## 1. Objetivo

Transformar **GestionMatriculasAdmin**, actualmente basada en **Electron + React + Vite + TypeScript**, en una **aplicación web/PWA ligera, multiplataforma y mantenible**, reduciendo el acoplamiento con Electron sin reescribir innecesariamente la interfaz existente.

### Prioridades

1. Eliminar Electron como requisito para la versión web.
2. Mantener React inicialmente para reducir riesgo y esfuerzo.
3. Conseguir una PWA instalable en escritorio y móvil.
4. Reducir RAM, CPU y JavaScript inicial.
5. Mantener las funcionalidades actuales tanto como sea posible.
6. Sustituir las capacidades de Electron que no existen en navegador por APIs web o backend.
7. Mantener una vía futura para empaquetar la misma aplicación con Tauri si determinadas funciones de escritorio lo requieren.

---

# 2. Arquitectura objetivo

```text
                         INTERNET
                            │
                  ┌─────────▼─────────┐
                  │  React + Vite     │
                  │       + PWA       │
                  │                   │
                  │ React Query       │
                  │ IndexedDB         │
                  │ Service Worker    │
                  └─────────┬─────────┘
                            │
                          HTTPS
                            │
                    ┌───────▼────────┐
                    │  BFF / Backend │
                    │                │
                    │ autenticación  │
                    │ sesiones       │
                    │ secretos       │
                    │ proxy API      │
                    └───────┬────────┘
                            │
                       x-api-key
                            │
                    ┌───────▼─────────┐
                    │ Power Automate  │
                    │                 │
                    │ Dataverse       │
                    │ Email           │
                    └─────────────────┘
```

## 2.1 Papel de cada capa

### React + Vite + PWA

Responsable de:

- interfaz;
- navegación;
- formularios;
- tablas;
- validación;
- estado de UI;
- caché local;
- experiencia offline;
- instalación como PWA.

### IndexedDB

Responsable de:

- datos locales;
- borradores;
- alumnos temporales;
- preferencias;
- presets;
- datos que deban estar disponibles offline;
- cola de sincronización.

### Service Worker

Responsable de:

- cachear el app shell;
- cachear JS/CSS/iconos/assets;
- permitir arranque offline;
- detectar nuevas versiones;
- coordinar actualizaciones.

### BFF / Backend

Responsable de:

- autenticación;
- sesión;
- secretos;
- acceso a Power Automate;
- validaciones que no deban estar en el cliente;
- operaciones privilegiadas.

### Power Automate / Dataverse

Se mantiene como backend empresarial actual, evitando trasladar innecesariamente toda la lógica de negocio.

---

# 3. Decisión tecnológica

## Mantener inicialmente

- React 19
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- Lucide
- TanStack Virtual

## Añadir

- `vite-plugin-pwa`
- IndexedDB
- una capa BFF/backend
- autenticación web
- pruebas de rendimiento

## Revisar o cargar bajo demanda

- `exceljs`
- `xlsx`
- `jszip`
- `pdf-lib`
- `react-pdf`
- `pdfjs-dist`
- `@react-pdf/renderer`
- `react-resizable-panels`

## Posibles eliminaciones de la versión web

- `electron`
- `electron-builder`
- `vite-plugin-electron`
- `vite-plugin-electron-renderer`
- `pdf-to-printer`

## Auditar

- `framer-motion`

La regla general es no cargar al inicio funcionalidades que solo se utilizan al exportar Excel/PDF o realizar operaciones especiales.

---

# 4. Por qué no migrar React → Svelte al principio

La aplicación actual ya tiene una base React/Vite funcional.

Cambiar simultáneamente:

```text
Electron + React
       ↓
SvelteKit + Svelte + PWA
```

introduciría dos grandes variables:

1. cambio de plataforma;
2. cambio de framework.

La estrategia propuesta es:

```text
Electron + React
       ↓
React + Vite + PWA
       ↓
medir
       ↓
decidir si React sigue siendo suficiente
       ↓
solo entonces evaluar Svelte
```

Esto permite localizar mejor las regresiones y conservar gran parte de la UI actual.

---

# 5. Estado actual relevante del repositorio

El repositorio ya utiliza:

- React 19
- TypeScript
- Vite
- Tailwind 4
- TanStack Query
- TanStack Virtual
- React Hook Form
- Zod

También contiene una integración considerable con Electron.

## Dependencias/funcionalidades a tener en cuenta

La aplicación utiliza, entre otras:

- `@react-pdf/renderer`
- `react-pdf`
- `pdfjs-dist`
- `pdf-lib`
- `pdf-to-printer`
- `exceljs`
- `xlsx`
- `jszip`
- `framer-motion`

Electron además proporciona una API `window.adminAPI` expuesta desde `preload.ts`.

Hay stores locales, backups, gestión de archivos, PDFs, impresión, ventanas auxiliares y acceso a Power Automate.

---

# 6. Punto crítico: desacoplar `window.adminAPI`

Actualmente existe una cadena parecida a:

```text
React
  ↓
window.adminAPI
  ↓
ipcRenderer
  ↓
ipcMain
  ↓
Node.js / filesystem / procesos
```

La nueva arquitectura debe pasar a:

```text
React
  ↓
servicios de aplicación
  ↓
API web / IndexedDB / Web APIs
```

## Crear una capa de servicios

Propuesta:

```text
src/
├── services/
│   ├── api/
│   ├── storage/
│   ├── files/
│   ├── pdf/
│   └── printer/
```

La UI no debe conocer Electron.

Por ejemplo:

```ts
interface FileService {
  openFile(options?: FilePickerOptions): Promise<File | null>;
  saveFile(file: Blob, filename: string): Promise<void>;
}
```

Esto permitirá mantener durante un tiempo:

```text
ElectronFileService
WebFileService
```

y cambiar de plataforma sin reescribir componentes.

---

# 7. Crear una capa `platform`

Propuesta:

```text
src/platform/
├── storage.ts
├── files.ts
├── printer.ts
└── dialogs.ts
```

Objetivo:

```text
componentes React
      ↓
platform/service
      ↓
implementación Electron o Web
```

Durante la migración pueden convivir ambas implementaciones.

---

# 8. Fase A — Crear una rama específica

No modificar `main` directamente.

```bash
git checkout -b web-pwa
```

Mantener:

```text
main
└── versión Electron estable

web-pwa
└── migración web
```

Esto permite comparar comportamiento y hacer entregas incrementales.

---

# 9. Fase B — Extraer React de Electron

## Objetivo

Pasar de:

```text
Electron + React + Vite
```

a:

```text
React + Vite
```

## Tareas

1. Identificar todos los usos de `window.adminAPI`.
2. Clasificarlos por funcionalidad.
3. Crear interfaces de servicios.
4. Sustituir llamadas directas de los componentes por esos servicios.
5. Mantener temporalmente una implementación Electron.
6. Crear implementación web.
7. Hacer que el renderer pueda funcionar sin Electron.
8. Ejecutar build web independiente.

---

# 10. Clasificación de las APIs de Electron

| Función actual | Sustitución propuesta |
|---|---|
| `localStorage` | `localStorage` |
| JSON local | IndexedDB |
| SQLite/tienda local | IndexedDB o backend |
| `fs` | File System Access API / subida al backend |
| `ipcRenderer` | `fetch()` / servicios web |
| `ipcMain` | endpoints del backend |
| cache | Service Worker |
| `BrowserWindow` | Modal / Dialog / ruta |
| impresión Electron | `window.print()` / PDF |
| `pdf-to-printer` | impresión del navegador o Tauri futuro |
| secretos | backend/BFF |
| notificaciones | Web Notifications/Push |
| procesos pesados | Web Worker/WASM/backend |
| acceso a impresoras | navegador; Tauri si se requiere control nativo |

---

# 11. Fase C — Eliminar el acoplamiento Vite-Electron

El `vite.config.ts` actual integra Electron mediante plugins.

La configuración web debe terminar conceptualmente en:

```text
Vite
├── React
├── Tailwind
└── PWA
```

Se eliminarán de la versión web, cuando ya no sean necesarios:

- `vite-plugin-electron`
- `vite-plugin-electron-renderer`
- configuración del main process
- configuración del preload
- `electron-builder`

No eliminar todo al principio. Hacerlo al final de la migración de cada subsistema.

---

# 12. Fase D — Convertir ventanas Electron en UI web

Actualmente existen varias ventanas `BrowserWindow`.

En la versión web se deben convertir preferentemente en:

- modal;
- drawer;
- dialog;
- panel lateral;
- ruta secundaria.

Evitar `window.open()` como sustituto general.

Los estados actuales basados en hashes como:

```text
#dialog-correccion
#dialog-enviar-horario
#dialog-nuevo-profesor
```

pueden transformarse progresivamente en estado de UI o routing.

---

# 13. Fase E — Crear el BFF

Este es un requisito de seguridad importante.

## Problema

La aplicación actual puede utilizar:

```text
x-api-key
```

porque Electron puede guardar el secreto usando capacidades del sistema operativo.

Una PWA no debe almacenar ese secreto en JavaScript del navegador.

## Arquitectura nueva

```text
Browser
  ↓
POST /api/solicitudes
  ↓
BFF
  ├── autentica
  ├── comprueba permisos
  ├── añade credenciales privadas
  └── llama a Power Automate
```

El `x-api-key` queda en:

```text
servidor
```

nunca en:

```text
bundle JavaScript
```

---

# 14. Autenticación

Propuesta:

```text
HTTPS
  ↓
login
  ↓
sesión segura
  ↓
cookies HttpOnly/Secure/SameSite
  ↓
BFF
```

Evitar almacenar credenciales o secretos sensibles en `localStorage`.

Las variables privadas deben permanecer en el servidor.

---

# 15. Fase F — Migrar las llamadas a la API

Actualmente el cliente API utiliza las URLs de Power Automate y una API key.

Objetivo:

```ts
fetch("/api/solicitudes", {
  method: "POST",
  body: JSON.stringify(payload)
});
```

Y el servidor hace:

```text
/api/solicitudes
      ↓
Power Automate
```

## Mantener

La mayor parte de los tipos de `src/api/types.ts`.

## Refactorizar

Los módulos de:

```text
src/api/
```

para que dejen de conocer:

- URLs secretas;
- API keys;
- detalles propios de Electron.

---

# 16. Fase G — IndexedDB

Los stores locales de Electron deberán trasladarse progresivamente a IndexedDB.

Propuesta:

```text
IndexedDB
│
├── matriculas
├── cursos
├── asignaturas
├── profesorado
├── horarios
├── alumnosTemporales
├── configuracion
├── presets
├── backups
└── syncQueue
```

## No utilizar una única clave JSON gigante

Preferir stores independientes e índices.

---

# 17. Qué debe ir en IndexedDB

Adecuado:

- alumnos temporales;
- borradores;
- preferencias;
- configuraciones;
- presets;
- datos recientes;
- operaciones pendientes;
- información necesaria para trabajar offline.

No guardar automáticamente:

- toda la base de datos remota;
- millones de registros;
- archivos enormes sin necesidad;
- datos que nunca se usan offline.

---

# 18. Alumnos temporales

La documentación actual indica que los alumnos temporales son datos únicamente locales y no se suben a la nube.

Ese caso encaja muy bien con:

```text
React
  ↓
IndexedDB
```

sin pasar por Power Automate.

---

# 19. Migración de los backups existentes

El proyecto ya dispone de un sistema de backups.

Reutilizar ese concepto para migrar datos de Electron a la web:

```text
Electron actual
       ↓
Exportar backup
       ↓
archivo de backup
       ↓
Nueva PWA
       ↓
Importar
       ↓
IndexedDB
```

Idealmente definir un formato versionado:

```json
{
  "version": 1,
  "createdAt": "...",
  "matriculas": [],
  "cursos": [],
  "temporales": [],
  "configuracion": {}
}
```

Esto permitirá migraciones futuras entre versiones.

---

# 20. Fase H — Añadir PWA

Instalar:

```bash
npm install -D vite-plugin-pwa
```

Configurar:

- manifest;
- iconos;
- nombre;
- short name;
- start URL;
- display standalone;
- Service Worker.

## Primer objetivo

Comenzar con `generateSW`.

Más adelante, si la lógica offline/sincronización lo requiere, evaluar `injectManifest`.

---

# 21. Estrategia de cache

## Cachear

- JS;
- CSS;
- iconos;
- fuentes;
- assets;
- app shell.

## No cachear indiscriminadamente

- respuestas de Dataverse;
- información personal;
- PDFs personales;
- toda la API.

Los datos que deban estar disponibles offline se deben gestionar explícitamente mediante IndexedDB.

---

# 22. Service Worker

Arquitectura conceptual:

```text
Petición
   │
   ▼
Service Worker
   │
   ├── app.js       → cache
   ├── app.css      → cache
   ├── iconos       → cache
   ├── assets       → cache
   │
   ├── /api/...     → red
   │
   └── datos local  → IndexedDB
```

---

# 23. Actualizaciones PWA

El sistema debe detectar una nueva versión:

```text
v1
 ↓
publicar v2
 ↓
Service Worker detecta cambios
 ↓
descarga nueva versión
 ↓
instala
 ↓
notifica
 ↓
usuario recarga
```

Evitar estados mezclados:

```text
HTML v2
JS v1
CSS v2
```

Utilizar assets versionados y una estrategia de actualización controlada.

---

# 24. Fase I — Offline-first progresivo

No convertir toda la aplicación en offline desde el primer sprint.

### Etapa 1

```text
online
+
cache de app shell
```

### Etapa 2

```text
online
+
IndexedDB
```

### Etapa 3

```text
offline
+
operaciones locales
```

### Etapa 4

```text
offline
+
sync queue
+
reintentos
```

---

# 25. Cola de sincronización

Propuesta:

```text
sync_queue
├── id
├── operation
├── payload
├── createdAt
├── retries
└── status
```

Ejemplo:

```text
Crear/editar matrícula
        ↓
IndexedDB
        ↓
syncQueue
        ↓
Internet vuelve
        ↓
POST /api/...
        ↓
OK
        ↓
marcar sincronizado
```

---

# 26. PDFs

Actualmente existen varias librerías PDF.

Objetivo: evitar cargarlas en el bundle inicial.

## Visualización

Preferir:

```html
<iframe src="...pdf">
```

o visor nativo del navegador cuando sea suficiente.

## Generación

Mantener `pdf-lib` solo si realmente se necesita en cliente.

Cargarla bajo demanda:

```ts
const { ... } = await import("pdf-lib");
```

## PDF complejo

Considerar generación en servidor si:

- el documento es pesado;
- necesita muchos recursos;
- no requiere generación offline;
- el bundle cliente se está haciendo grande.

---

# 27. Impresión

La función actual de `pdf-to-printer` depende del entorno de escritorio y no debe intentar copiarse literalmente a una PWA.

Versión web:

```text
Generar PDF
   ↓
Vista previa
   ↓
window.print()
```

El navegador/OS controla la selección de impresora.

## Si se necesita

- seleccionar impresora concreta;
- configuraciones avanzadas;
- impresión silenciosa;
- acceso a impresoras del sistema;

entonces mantener la posibilidad futura de:

```text
React + Vite/PWA + Tauri
```

para un cliente de escritorio opcional.

---

# 28. Excel

Actualmente aparecen `exceljs`, `xlsx` y `jszip`.

No cargar estas librerías en el arranque.

Usar:

```text
app normal
   ↓
usuario pulsa Exportar Excel
   ↓
dynamic import
   ↓
cargar librería
   ↓
generar archivo
```

Lo mismo para importación.

---

# 29. Animaciones

Auditar `framer-motion`.

Para animaciones simples:

- CSS transitions;
- CSS animations.

Mantener `framer-motion` solo cuando realmente aporte valor.

---

# 30. Tablas grandes

Mantener:

```text
@tanstack/react-virtual
```

La virtualización será más importante en tablas grandes que pequeñas diferencias entre frameworks.

Usar virtualización para:

- matrículas;
- alumnos;
- profesorado;
- horarios;
- listados grandes;
- resultados de búsquedas.

---

# 31. Code splitting

El bundle inicial debería contener solamente:

```text
core
├── React
├── layout
├── navegación
├── autenticación
└── componentes fundamentales
```

Las funcionalidades grandes deben cargarse bajo demanda:

```text
PDF
Excel
Horarios avanzados
Informes
Backups
```

Evitar que entrar en Dashboard descargue todo el sistema.

---

# 32. Arquitectura de carpetas propuesta

```text
src/
├── app/
│   ├── App.tsx
│   └── providers/
│
├── api/
│   ├── solicitudes.ts
│   ├── asignaturas.ts
│   ├── profesorado.ts
│   └── email.ts
│
├── features/
│   ├── matriculas/
│   ├── profesorado/
│   ├── horarios/
│   ├── temporales/
│   ├── informes/
│   └── backups/
│
├── components/
│   ├── ui/
│   └── layout/
│
├── storage/
│   ├── db.ts
│   ├── matriculas.ts
│   ├── cursos.ts
│   └── sync.ts
│
├── platform/
│   ├── files.ts
│   ├── printer.ts
│   └── pdf.ts
│
├── hooks/
│
└── utils/
```

No hace falta mover todo de una vez.

---

# 33. React Query

Mantener TanStack Query.

Configuración actual con:

```text
staleTime
retry
refetchOnWindowFocus
```

puede mantenerse y revisarse según las necesidades reales de la aplicación web.

Arquitectura:

```text
React Query
      ↓
BFF
      ↓
Power Automate
      ↓
Dataverse
```

Posteriormente:

```text
React Query
      +
IndexedDB
```

para estrategias offline.

---

# 34. Rendimiento

No medir solo “sensación”.

Medir:

```text
RAM
CPU
JS inicial
CSS inicial
First Contentful Paint
Largest Contentful Paint
TTFB
tiempo de interacción
bundle total
bundle inicial
```

Herramientas:

- Chrome DevTools
- Lighthouse
- Performance
- Memory
- Coverage
- WebPageTest

---

# 35. Tabla de métricas antes/después

Crear una hoja de seguimiento:

| Métrica | Electron actual | Web PWA | Objetivo |
|---|---:|---:|---:|
| RAM inicial | medir | medir | reducir |
| RAM con datos grandes | medir | medir | reducir |
| CPU idle | medir | medir | reducir |
| JS inicial | medir | medir | reducir |
| tiempo de arranque | medir | medir | reducir |
| bundle inicial | medir | medir | reducir |
| tiempo de carga dashboard | medir | medir | mejorar |
| exportación PDF | medir | medir | mantener |
| exportación Excel | medir | medir | mantener |

No asumir cifras sin medir la aplicación real.

---

# 36. Optimización de imágenes

Aplicar:

- WebP/AVIF donde proceda;
- tamaños adaptativos;
- lazy loading;
- thumbnails;
- compresión.

Evitar cargar imágenes completas cuando solo se necesita una miniatura.

---

# 37. Fuentes

Preferir:

- pocas familias;
- pocos pesos;
- WOFF2;
- evitar cargar fuentes que no se usan.

---

# 38. Iconos

No cargar una colección gigantesca si solo se usan unos pocos iconos.

Auditar el uso de `lucide-react` y comprobar el tree-shaking final.

---

# 39. Seguridad y datos personales

La aplicación maneja información personal y académica.

Principios:

1. HTTPS obligatorio.
2. No exponer claves privadas al navegador.
3. Cookies seguras para sesión.
4. Control de permisos en backend.
5. No usar el Service Worker como almacenamiento indiscriminado de datos personales.
6. Definir claramente qué datos se almacenan offline.
7. Permitir borrar datos locales.
8. Versionar migraciones de IndexedDB.
9. Controlar backups y exportaciones.
10. Registrar errores sin incluir información personal innecesaria.

---

# 40. Despliegue

Una PWA necesita servir la aplicación mediante HTTPS en producción.

Arquitectura posible:

```text
                  CDN / Hosting
                       │
                  React + Vite
                       │
                    HTTPS
                       │
                   /api/*
                       │
                      BFF
                       │
                Power Automate
                       │
                   Dataverse
```

Opciones para el frontend:

- servidor estático/CDN;
- Vercel;
- Netlify;
- Cloudflare Pages;
- Azure Static Web Apps;
- otro hosting estático compatible.

Opciones para BFF:

- Vercel Functions;
- Cloudflare Workers;
- Azure Functions;
- Node/TypeScript;
- Go;
- servidor propio.

Elegir según el entorno Microsoft existente y necesidades de autenticación.

---

# 41. Roadmap por bloques

## Bloque A — Desacoplamiento

1. Crear rama `web-pwa`.
2. Localizar todos los usos de `window.adminAPI`.
3. Crear interfaces de servicios.
4. Separar lógica de negocio de Electron.
5. Mantener Electron funcionando.

## Bloque B — Web básica

6. Eliminar dependencia del main/preload en React.
7. Crear build React/Vite puro.
8. Sustituir `BrowserWindow`.
9. Sustituir filesystem.
10. Sustituir impresión.

## Bloque C — Backend seguro

11. Crear BFF.
12. Mover `x-api-key` al servidor.
13. Añadir autenticación.
14. Adaptar `src/api/*`.
15. Eliminar secretos de la UI.

## Bloque D — Datos locales

16. Crear IndexedDB.
17. Migrar `local-store`.
18. Migrar `cursos-store`.
19. Migrar profesorado.
20. Migrar horarios.
21. Migrar alumnos temporales.
22. Crear importación de backups.

## Bloque E — Optimización

23. Instalar/configurar PWA.
24. Service Worker.
25. Code splitting.
26. Lazy loading de PDF.
27. Lazy loading de Excel.
28. Auditar dependencias.
29. Optimizar imágenes y fuentes.
30. Medir bundle.

## Bloque F — Offline

31. App shell offline.
32. IndexedDB.
33. Sync queue.
34. Reintentos.
35. Indicador online/offline.
36. Resolución de conflictos.

---

# 42. Orden recomendado para la implementación real

## Sprint 1
Desacoplar `window.adminAPI`.

Resultado:

```text
React
 ↓
services
 ↓
Electron implementation
```

La aplicación sigue funcionando igual.

## Sprint 2
Crear:

```text
Web implementation
```

y hacer funcionar las pantallas que no requieren capacidades nativas.

## Sprint 3
Crear BFF + autenticación.

## Sprint 4
Migrar stores locales a IndexedDB.

## Sprint 5
Integrar PWA.

## Sprint 6
Convertir ventanas/diálogos Electron en UI web.

## Sprint 7
Optimizar PDF/Excel y aplicar lazy loading.

## Sprint 8
Offline-first y sincronización.

---

# 43. Criterio de aceptación de la migración

La versión web debe cumplir:

### Funcional

- login;
- carga de solicitudes;
- consulta/edición;
- cursos/asignaturas;
- profesorado;
- horarios;
- alumnos temporales;
- informes;
- exportaciones;
- configuraciones.

### Técnico

- no necesita Electron;
- no expone secretos;
- funciona por HTTPS;
- instalable como PWA;
- arranque rápido;
- recursos cargados bajo demanda;
- IndexedDB versionada;
- estrategia de actualización PWA.

### Compatibilidad

- Chrome/Edge;
- Firefox;
- Safari;
- Android;
- iOS;
- Windows;
- macOS;
- Linux.

Las capacidades específicas deben comprobarse por navegador/plataforma cuando dependan de APIs web concretas.

---

# 44. Arquitectura futura opcional con Tauri

Una vez establecida la PWA:

```text
                     React + Vite
                           │
                    ┌──────┴──────┐
                    │             │
                   PWA          Tauri
                    │             │
                navegador      escritorio
```

Esto permite ofrecer:

- PWA para la mayoría de usuarios;
- aplicación Tauri para administradores que necesiten funciones nativas.

Las dos pueden compartir gran parte de la aplicación React.

---

# 45. Recomendación final para este proyecto

Para **GestionMatriculasAdmin** la ruta recomendada es:

```text
Electron + React
        ↓
React + Vite
        ↓
React + Vite + PWA
        ↓
IndexedDB + BFF
        ↓
optimización y offline
        ↓
Tauri opcional para escritorio
```

No realizar inicialmente:

```text
Electron + React
        ↓
SvelteKit + Svelte
```

La migración más importante es eliminar el acoplamiento de Electron y trasladar las responsabilidades adecuadamente.

---

# 46. Prioridades de impacto

Orden aproximado:

```text
1. Eliminar Electron
2. Sacar secretos del cliente
3. Separar filesystem/IPC
4. Lazy loading de PDF/Excel
5. IndexedDB bien diseñada
6. Code splitting
7. Optimizar tablas
8. Service Worker/PWA
9. Optimizar imágenes/fuentes
10. Evaluar React → Svelte solo después de medir
```

El cambio **Electron → Web/PWA** probablemente tendrá mucho más impacto arquitectónico que un cambio inmediato de React → Svelte.

---

# 47. Decisión recomendada

## Arquitectura objetivo

**React + Vite + PWA + IndexedDB + BFF + Power Automate + Dataverse**

## Estrategia de escritorio

**Tauri opcional**, únicamente si después se necesita integración nativa que una PWA no pueda cubrir.

## Estrategia de framework

**Mantener React durante la migración**.

Evaluar Svelte posteriormente mediante métricas reales de:

- bundle;
- RAM;
- CPU;
- rendimiento de renderizado;
- complejidad de mantenimiento.

---

# 48. Referencias

- Repositorio del proyecto:
  https://github.com/JesusCardenas72/GestionMatriculasAdmin

- Vite:
  https://vite.dev/

- React:
  https://react.dev/

- Vite PWA:
  https://vite-pwa-org.netlify.app/

- Service Workers:
  https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

- IndexedDB:
  https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

- Power Automate:
  https://learn.microsoft.com/power-automate/

- Tauri:
  https://tauri.app/

---

# 49. Primer objetivo práctico

El primer hito no debe ser “tener una PWA”.

Debe ser:

```text
Electron + React
        ↓
React
        ↓
services/
        ↓
dos implementaciones:
   ├── Electron
   └── Web
```

Cuando este punto funcione, el resto de la migración será mucho más controlable.

