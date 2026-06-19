import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

/**
 * Copia de seguridad completa (Fase 1: GUARDAR).
 *
 * Empaqueta en un único ZIP (extensión .gmbackup) las partes locales que el
 * usuario elija. NO incluye credenciales (config.enc) ni el estado de la ventana.
 * Ver PLAN-CopiaSeguridad.md.
 */

// ── Tipos compartidos con el renderer ─────────────────────────────────────────

/** Qué hay disponible en este equipo, para pintar el selector antes de guardar. */
export interface BackupInventario {
  matriculas: { curso: string; total: number; pdfs: number }[];
  horarios: { curso: string; entries: number; snapshots: number }[];
  profesorado: number;
  campanyas: number;
  presets: number;
  temporalesCursos: number;
  cursoSeleccionado: string | null;
}

/** Elección del usuario. Una categoría ausente/false = no se incluye. */
export interface BackupSeleccion {
  matriculas?: { cursos: string[]; conPdfs: boolean };
  horarios?: { cursos: string[]; conHistorico: boolean };
  profesorado?: boolean;
  campanyas?: boolean;
  presets?: boolean;
  temporales?: boolean;
  preferencias?: boolean;
}

export interface BackupManifest {
  tipo: "gestion-matriculas-backup";
  formatoVersion: number;
  appVersion: string;
  creadoEn: string;
  incluyeCredenciales: false;
  seleccion: BackupSeleccion;
  contenido: {
    totalMatriculas: number;
    totalPdfs: number;
    presets: number;
    campanyas: number;
    cursos: string[];
  };
}

export interface BackupResumen {
  ruta: string;
  totalMatriculas: number;
  totalPdfs: number;
  presets: number;
  campanyas: number;
  cursos: string[];
}

export const BACKUP_FORMATO_VERSION = 1;

// ── Rutas ──────────────────────────────────────────────────────────────────────

const userData = (): string => app.getPath("userData");

function cursoSafe(curso: string): string {
  return curso.replace(/\//g, "-");
}

function matriculasFile(curso: string): string {
  return path.join(userData(), "cursos", `matriculas-${cursoSafe(curso)}.json`);
}

function pdfsDir(curso: string): string {
  return path.join(userData(), "cursos", "pdfs", cursoSafe(curso));
}

function horariosFile(curso: string): string {
  return path.join(userData(), "horarios-data", `horarios-${cursoSafe(curso)}.json`);
}

// ── Lectura segura de JSON ──────────────────────────────────────────────────────

function leerJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

// ── Inventario (para el selector) ────────────────────────────────────────────────

export function listarContenidoDisponible(): BackupInventario {
  const dir = userData();

  // Matrículas: a partir del índice de cursos conocidos.
  const indice = leerJson<{ curso: string; totalRegistros: number }[]>(
    path.join(dir, "cursos", "cursos-conocidos.json"),
    [],
  );
  const matriculas = indice.map((c) => {
    const pdfDir = pdfsDir(c.curso);
    let pdfs = 0;
    if (fs.existsSync(pdfDir)) {
      try {
        pdfs = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith(".pdf")).length;
      } catch {
        pdfs = 0;
      }
    }
    return { curso: c.curso, total: c.totalRegistros, pdfs };
  });

  // Horarios: a partir de los ficheros de horarios-data/.
  const horariosDir = path.join(dir, "horarios-data");
  const horarios: BackupInventario["horarios"] = [];
  if (fs.existsSync(horariosDir)) {
    for (const file of fs.readdirSync(horariosDir)) {
      const m = /^horarios-(\d{2})-(\d{2})\.json$/.exec(file);
      if (!m) continue;
      const curso = `${m[1]}/${m[2]}`;
      const data = leerJson<{ entries?: unknown[]; snapshots?: unknown[] }>(
        path.join(horariosDir, file),
        {},
      );
      horarios.push({
        curso,
        entries: data.entries?.length ?? 0,
        snapshots: data.snapshots?.length ?? 0,
      });
    }
  }

  const profesoresCfg = leerJson<{ profesores?: string[] }>(
    path.join(dir, "horarios-config.json"),
    {},
  );
  const campanyas = leerJson<unknown[]>(path.join(dir, "horarios-campanyas.json"), []);
  const presets = leerJson<unknown[]>(path.join(dir, "informes-presets.json"), []);
  const temporales = leerJson<Record<string, unknown>>(
    path.join(dir, "temporales-config.json"),
    {},
  );
  const cursoCtx = leerJson<{ cursoSeleccionado?: string }>(
    path.join(dir, "curso-context.json"),
    {},
  );

  return {
    matriculas,
    horarios,
    profesorado: profesoresCfg.profesores?.length ?? 0,
    campanyas: campanyas.length,
    presets: presets.length,
    temporalesCursos: Object.keys(temporales).length,
    cursoSeleccionado: cursoCtx.cursoSeleccionado ?? null,
  };
}

// ── Crear el ZIP ────────────────────────────────────────────────────────────────

/** Añade un fichero del userData al zip tal cual, si existe. */
function addFileIfExists(zip: JSZip, absPath: string, zipPath: string): boolean {
  if (!fs.existsSync(absPath)) return false;
  zip.file(zipPath, fs.readFileSync(absPath));
  return true;
}

export async function crearBackup(
  seleccion: BackupSeleccion,
  destPath: string,
  onProgreso?: (percent: number) => void,
): Promise<BackupResumen> {
  const dir = userData();
  const zip = new JSZip();

  let totalMatriculas = 0;
  let totalPdfs = 0;
  let presets = 0;
  let campanyas = 0;
  const cursos = new Set<string>();

  // ── A) Matrículas (+ índice filtrado + PDFs) ──
  if (seleccion.matriculas && seleccion.matriculas.cursos.length > 0) {
    const { cursos: cursosSel, conPdfs } = seleccion.matriculas;
    const indice = leerJson<{ curso: string; totalRegistros: number; archivadoEn: string | null; ultimaModificacion: string }[]>(
      path.join(dir, "cursos", "cursos-conocidos.json"),
      [],
    );
    // Índice filtrado a los cursos elegidos.
    const indiceFiltrado = indice.filter((c) => cursosSel.includes(c.curso));
    if (indiceFiltrado.length > 0) {
      zip.file("cursos/cursos-conocidos.json", JSON.stringify(indiceFiltrado, null, 2));
    }

    for (const curso of cursosSel) {
      const file = matriculasFile(curso);
      if (!fs.existsSync(file)) continue;
      cursos.add(curso);
      const registros = leerJson<unknown[]>(file, []);
      totalMatriculas += registros.length;
      zip.file(`cursos/matriculas-${cursoSafe(curso)}.json`, fs.readFileSync(file));

      if (conPdfs) {
        const pdfDir = pdfsDir(curso);
        if (fs.existsSync(pdfDir)) {
          for (const pdf of fs.readdirSync(pdfDir)) {
            if (!pdf.toLowerCase().endsWith(".pdf")) continue;
            zip.file(`cursos/pdfs/${cursoSafe(curso)}/${pdf}`, fs.readFileSync(path.join(pdfDir, pdf)));
            totalPdfs++;
          }
        }
      }
    }
  }

  // ── B) Horarios cooperativos ──
  if (seleccion.horarios && seleccion.horarios.cursos.length > 0) {
    const { cursos: cursosSel, conHistorico } = seleccion.horarios;
    for (const curso of cursosSel) {
      const file = horariosFile(curso);
      if (!fs.existsSync(file)) continue;
      cursos.add(curso);
      if (conHistorico) {
        zip.file(`horarios-data/horarios-${cursoSafe(curso)}.json`, fs.readFileSync(file));
      } else {
        // Estado actual sin el histórico de snapshots.
        const data = leerJson<Record<string, unknown>>(file, {});
        const sinHistorico = { ...data, snapshots: [] };
        zip.file(`horarios-data/horarios-${cursoSafe(curso)}.json`, JSON.stringify(sinHistorico));
      }
    }
  }

  // ── C) Profesorado (solo la lista, sin rutas absolutas de este PC) ──
  if (seleccion.profesorado) {
    const cfg = leerJson<{ profesores?: string[] }>(
      path.join(dir, "horarios-config.json"),
      {},
    );
    if (cfg.profesores && cfg.profesores.length > 0) {
      zip.file("horarios-config.json", JSON.stringify({ profesores: cfg.profesores }, null, 2));
    }
  }

  // ── D) Campañas de envío ──
  if (seleccion.campanyas) {
    const lista = leerJson<unknown[]>(path.join(dir, "horarios-campanyas.json"), []);
    campanyas = lista.length;
    if (lista.length > 0) {
      addFileIfExists(zip, path.join(dir, "horarios-campanyas.json"), "horarios-campanyas.json");
    }
  }

  // ── E) Presets de informes (+ predefinidos ocultos) ──
  if (seleccion.presets) {
    const lista = leerJson<unknown[]>(path.join(dir, "informes-presets.json"), []);
    presets = lista.length;
    addFileIfExists(zip, path.join(dir, "informes-presets.json"), "informes-presets.json");
    addFileIfExists(zip, path.join(dir, "informes-predefinidos-ocultos.json"), "informes-predefinidos-ocultos.json");
  }

  // ── F) Alumnos temporales ──
  if (seleccion.temporales) {
    addFileIfExists(zip, path.join(dir, "temporales-config.json"), "temporales-config.json");
  }

  // ── G) Preferencias ──
  if (seleccion.preferencias) {
    addFileIfExists(zip, path.join(dir, "curso-context.json"), "curso-context.json");
  }

  // ── Manifest ──
  const cursosOrdenados = [...cursos].sort((a, b) => b.localeCompare(a));
  const manifest: BackupManifest = {
    tipo: "gestion-matriculas-backup",
    formatoVersion: BACKUP_FORMATO_VERSION,
    appVersion: app.getVersion(),
    creadoEn: new Date().toISOString(),
    incluyeCredenciales: false,
    seleccion,
    contenido: {
      totalMatriculas,
      totalPdfs,
      presets,
      campanyas,
      cursos: cursosOrdenados,
    },
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const buffer = await zip.generateAsync(
    {
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    (meta) => onProgreso?.(Math.round(meta.percent)),
  );
  fs.writeFileSync(destPath, buffer);

  return {
    ruta: destPath,
    totalMatriculas,
    totalPdfs,
    presets,
    campanyas,
    cursos: cursosOrdenados,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  Fase 2/3: ABRIR / RESTAURAR
// ══════════════════════════════════════════════════════════════════════════════

export type RestauracionModo = "reemplazar" | "fusionar";

export interface RestauracionResumen {
  modo: RestauracionModo;
  categorias: string[];
  cursos: string[];
  respaldoPrevio: string | null;
}

/** Lee y valida solo el manifest del ZIP, sin extraer nada más. */
export async function leerManifest(zipPath: string): Promise<BackupManifest> {
  if (!fs.existsSync(zipPath)) {
    throw new Error("El archivo no existe.");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  } catch {
    throw new Error("El archivo no es una copia de seguridad válida (no se pudo abrir).");
  }
  const entry = zip.file("manifest.json");
  if (!entry) {
    throw new Error("El archivo no es una copia de seguridad válida (falta el manifiesto).");
  }
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await entry.async("string")) as BackupManifest;
  } catch {
    throw new Error("El manifiesto de la copia está dañado.");
  }
  if (manifest.tipo !== "gestion-matriculas-backup") {
    throw new Error("El archivo no es una copia de seguridad de esta aplicación.");
  }
  if (manifest.formatoVersion > BACKUP_FORMATO_VERSION) {
    throw new Error(
      `La copia se creó con una versión más nueva de la app (formato ${manifest.formatoVersion}). ` +
        "Actualiza la aplicación para poder abrirla.",
    );
  }
  return manifest;
}

// ── Utilidades ──────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizarNombre(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

async function zipFileBuffer(zip: JSZip, p: string): Promise<Buffer | null> {
  const f = zip.file(p);
  if (!f) return null;
  return f.async("nodebuffer");
}

async function zipJson<T>(zip: JSZip, p: string, fallback: T): Promise<T> {
  const f = zip.file(p);
  if (!f) return fallback;
  try {
    return JSON.parse(await f.async("string")) as T;
  } catch {
    return fallback;
  }
}

/** Crea automáticamente una copia completa del estado actual antes de restaurar. */
export async function respaldoAutomaticoPrevio(): Promise<string | null> {
  const inv = listarContenidoDisponible();
  const sel: BackupSeleccion = {};
  if (inv.matriculas.length > 0) {
    sel.matriculas = { cursos: inv.matriculas.map((c) => c.curso), conPdfs: true };
  }
  if (inv.horarios.length > 0) {
    sel.horarios = { cursos: inv.horarios.map((c) => c.curso), conHistorico: true };
  }
  if (inv.profesorado > 0) sel.profesorado = true;
  if (inv.campanyas > 0) sel.campanyas = true;
  if (inv.presets > 0) sel.presets = true;
  if (inv.temporalesCursos > 0) sel.temporales = true;
  if (inv.cursoSeleccionado != null) sel.preferencias = true;

  if (Object.keys(sel).length === 0) return null; // nada que respaldar

  const dir = path.join(userData(), "_pre-restore");
  ensureDir(dir);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const destPath = path.join(dir, `pre-restore-${ts}.gmbackup`);
  await crearBackup(sel, destPath);
  return destPath;
}

// ── Restaurar ─────────────────────────────────────────────────────────────────

export async function restaurarBackup(
  zipPath: string,
  seleccion: BackupSeleccion,
  modo: RestauracionModo,
  onProgreso?: (percent: number) => void,
): Promise<RestauracionResumen> {
  await leerManifest(zipPath); // valida de nuevo (lanza si no es válido)
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const dir = userData();
  const categorias: string[] = [];
  const cursosTocados = new Set<string>();

  // ── Contador de progreso ──
  let total = 0;
  if (seleccion.matriculas) {
    total += seleccion.matriculas.cursos.length;
    if (seleccion.matriculas.conPdfs) {
      for (const curso of seleccion.matriculas.cursos) {
        const prefix = `cursos/pdfs/${cursoSafe(curso)}/`;
        total += Object.keys(zip.files).filter((p) => p.startsWith(prefix) && !zip.files[p].dir).length;
      }
    }
  }
  if (seleccion.horarios) total += seleccion.horarios.cursos.length;
  for (const k of ["profesorado", "campanyas", "presets", "temporales", "preferencias"] as const) {
    if (seleccion[k]) total += 1;
  }
  let hecho = 0;
  const tick = (): void => {
    hecho++;
    if (total > 0) onProgreso?.(Math.min(99, Math.round((hecho / total) * 100)));
  };

  // Red de seguridad: respaldo del estado actual antes de tocar nada.
  const respaldoPrevio = await respaldoAutomaticoPrevio();

  // ── A) Matrículas ──
  if (seleccion.matriculas && seleccion.matriculas.cursos.length > 0) {
    const { cursos, conPdfs } = seleccion.matriculas;
    for (const curso of cursos) {
      const buf = await zipFileBuffer(zip, `cursos/matriculas-${cursoSafe(curso)}.json`);
      if (!buf) continue;
      cursosTocados.add(curso);
      const destFile = matriculasFile(curso);
      ensureDir(path.dirname(destFile));

      const deLaCopia = JSON.parse(buf.toString("utf-8")) as { localId?: string; rowId?: string }[];

      if (modo === "reemplazar") {
        fs.writeFileSync(destFile, JSON.stringify(deLaCopia), "utf-8");
      } else {
        // Fusionar: añadir las que falten (por localId o rowId); no pisar existentes.
        const existentes = leerJson<{ localId?: string; rowId?: string }[]>(destFile, []);
        const ids = new Set(existentes.map((r) => r.localId).filter(Boolean));
        const rowIds = new Set(existentes.filter((r) => r.rowId).map((r) => r.rowId!));
        const merged = [...existentes];
        for (const r of deLaCopia) {
          if ((r.localId && ids.has(r.localId)) || (r.rowId && rowIds.has(r.rowId))) continue;
          merged.push(r);
          if (r.localId) ids.add(r.localId);
          if (r.rowId) rowIds.add(r.rowId);
        }
        fs.writeFileSync(destFile, JSON.stringify(merged), "utf-8");
      }

      // PDFs: añadir/sobrescribir los presentes en la copia (nunca borra los locales).
      if (conPdfs) {
        const prefix = `cursos/pdfs/${cursoSafe(curso)}/`;
        const destPdfDir = pdfsDir(curso);
        for (const p of Object.keys(zip.files)) {
          if (!p.startsWith(prefix) || zip.files[p].dir) continue;
          const pdfBuf = await zipFileBuffer(zip, p);
          if (!pdfBuf) continue;
          ensureDir(destPdfDir);
          fs.writeFileSync(path.join(destPdfDir, path.basename(p)), pdfBuf);
          tick();
        }
      }
      tick();
    }
    // Reconstruir el índice de cursos conocidos para los cursos tocados.
    actualizarIndiceCursos([...cursosTocados]);
    categorias.push("Matrículas");
  }

  // ── B) Horarios ──
  if (seleccion.horarios && seleccion.horarios.cursos.length > 0) {
    for (const curso of seleccion.horarios.cursos) {
      const deLaCopia = await zipJson<{ entries?: any[]; snapshots?: any[]; lastUpdated?: string | null } & Record<string, unknown>>(
        zip,
        `horarios-data/horarios-${cursoSafe(curso)}.json`,
        null as any,
      );
      if (!deLaCopia) continue;
      cursosTocados.add(curso);
      const destFile = horariosFile(curso);
      ensureDir(path.dirname(destFile));

      if (modo === "reemplazar") {
        fs.writeFileSync(destFile, JSON.stringify(deLaCopia), "utf-8");
      } else {
        const existente = leerJson<{ entries?: any[]; snapshots?: any[] } & Record<string, unknown>>(
          destFile,
          { curso, entries: [], snapshots: [], lastUpdated: null },
        );
        const entries = existente.entries ?? [];
        const keys = new Set(entries.map((e: any) => e.key));
        for (const e of deLaCopia.entries ?? []) if (!keys.has(e.key)) entries.push(e);
        const snaps = existente.snapshots ?? [];
        const snapIds = new Set(snaps.map((s: any) => s.id));
        for (const s of deLaCopia.snapshots ?? []) if (!snapIds.has(s.id)) snaps.push(s);
        snaps.sort((a: any, b: any) => String(a.timestamp).localeCompare(String(b.timestamp)));
        fs.writeFileSync(destFile, JSON.stringify({ ...existente, entries, snapshots: snaps }), "utf-8");
      }
      tick();
    }
    categorias.push("Horarios cooperativos");
  }

  // ── C) Profesorado ──
  if (seleccion.profesorado) {
    const deLaCopia = await zipJson<{ profesores?: string[] }>(zip, "horarios-config.json", {});
    const profesoresCopia = deLaCopia.profesores ?? [];
    const cfgFile = path.join(dir, "horarios-config.json");
    const cfgActual = leerJson<{ profesores?: string[] } & Record<string, unknown>>(cfgFile, {});
    let profesores: string[];
    if (modo === "reemplazar") {
      profesores = profesoresCopia;
    } else {
      const vistos = new Set((cfgActual.profesores ?? []).map(normalizarNombre));
      profesores = [...(cfgActual.profesores ?? [])];
      for (const n of profesoresCopia) {
        const clave = normalizarNombre(n);
        if (!vistos.has(clave)) {
          vistos.add(clave);
          profesores.push(n);
        }
      }
    }
    // Conservamos el resto de campos del config local (rutas de este PC).
    fs.writeFileSync(cfgFile, JSON.stringify({ ...cfgActual, profesores }, null, 2), "utf-8");
    categorias.push("Profesorado");
    tick();
  }

  // ── D) Campañas ──
  if (seleccion.campanyas) {
    const file = path.join(dir, "horarios-campanyas.json");
    const deLaCopia = await zipJson<{ id?: string }[]>(zip, "horarios-campanyas.json", []);
    if (modo === "reemplazar") {
      fs.writeFileSync(file, JSON.stringify(deLaCopia, null, 2), "utf-8");
    } else {
      const existentes = leerJson<{ id?: string }[]>(file, []);
      const ids = new Set(existentes.map((c) => c.id));
      const merged = [...existentes];
      for (const c of deLaCopia) if (!ids.has(c.id)) merged.push(c);
      fs.writeFileSync(file, JSON.stringify(merged, null, 2), "utf-8");
    }
    categorias.push("Campañas de envío");
    tick();
  }

  // ── E) Presets (+ predefinidos ocultos) ──
  if (seleccion.presets) {
    const presetsFile = path.join(dir, "informes-presets.json");
    const deLaCopia = await zipJson<{ id?: string }[]>(zip, "informes-presets.json", []);
    if (modo === "reemplazar") {
      fs.writeFileSync(presetsFile, JSON.stringify(deLaCopia, null, 2), "utf-8");
    } else {
      const existentes = leerJson<{ id?: string }[]>(presetsFile, []);
      const ids = new Set(existentes.map((p) => p.id));
      const merged = [...existentes];
      for (const p of deLaCopia) if (!ids.has(p.id)) merged.push(p);
      fs.writeFileSync(presetsFile, JSON.stringify(merged, null, 2), "utf-8");
    }
    // Predefinidos ocultos
    const ocultosFile = path.join(dir, "informes-predefinidos-ocultos.json");
    const ocultosCopia = await zipJson<string[]>(zip, "informes-predefinidos-ocultos.json", []);
    if (zip.file("informes-predefinidos-ocultos.json")) {
      if (modo === "reemplazar") {
        fs.writeFileSync(ocultosFile, JSON.stringify(ocultosCopia, null, 2), "utf-8");
      } else {
        const union = new Set([...leerJson<string[]>(ocultosFile, []), ...ocultosCopia]);
        fs.writeFileSync(ocultosFile, JSON.stringify([...union], null, 2), "utf-8");
      }
    }
    categorias.push("Presets de informes");
    tick();
  }

  // ── F) Alumnos temporales ──
  if (seleccion.temporales) {
    const file = path.join(dir, "temporales-config.json");
    const deLaCopia = await zipJson<Record<string, unknown>>(zip, "temporales-config.json", {});
    if (modo === "reemplazar") {
      fs.writeFileSync(file, JSON.stringify(deLaCopia, null, 2), "utf-8");
    } else {
      const existente = leerJson<Record<string, unknown>>(file, {});
      // Fusionar por curso: conservar lo existente, añadir cursos que falten.
      const merged = { ...deLaCopia, ...existente };
      fs.writeFileSync(file, JSON.stringify(merged, null, 2), "utf-8");
    }
    categorias.push("Alumnos temporales");
    tick();
  }

  // ── G) Preferencias ──
  if (seleccion.preferencias) {
    // Solo se aplica en modo reemplazar; en fusión no se toca el curso actual.
    if (modo === "reemplazar") {
      const buf = await zipFileBuffer(zip, "curso-context.json");
      if (buf) {
        fs.writeFileSync(path.join(dir, "curso-context.json"), buf);
        categorias.push("Preferencias");
      }
    }
    tick();
  }

  onProgreso?.(100);
  return {
    modo,
    categorias,
    cursos: [...cursosTocados].sort((a, b) => b.localeCompare(a)),
    respaldoPrevio,
  };
}

/** Recalcula las entradas del índice cursos-conocidos.json para los cursos dados. */
function actualizarIndiceCursos(cursos: string[]): void {
  const indexFile = path.join(userData(), "cursos", "cursos-conocidos.json");
  const index = leerJson<{ curso: string; totalRegistros: number; archivadoEn: string | null; ultimaModificacion: string }[]>(
    indexFile,
    [],
  );
  const now = new Date().toISOString();
  for (const curso of cursos) {
    const total = leerJson<unknown[]>(matriculasFile(curso), []).length;
    const existing = index.find((c) => c.curso === curso);
    if (existing) {
      existing.totalRegistros = total;
      existing.ultimaModificacion = now;
    } else {
      index.push({ curso, totalRegistros: total, archivadoEn: null, ultimaModificacion: now });
    }
  }
  ensureDir(path.dirname(indexFile));
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), "utf-8");
}
