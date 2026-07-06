import ExcelJS from 'exceljs';
import type { CargaHorarios, ClaseHorario, HorarioAlumno } from '../horarios/types';
import { CAMPOS_META, CAMPOS_ASIGNATURA } from '../data/informesConfig';

/** Quita acentos, espacios sobrantes y pasa a minúsculas para comparar cabeceras. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Indica si una asignatura es la de «Instrumento» que determina el Tutor/a.
 * «Instrumento Complementario» NUNCA define el tutor, aunque contenga la palabra
 * «instrumento», por lo que se excluye explícitamente.
 */
export function esAsignaturaTutoraInstrumento(asignatura: string): boolean {
  const asig = (asignatura ?? '').toLowerCase();
  return asig.includes('instrumento') && !asig.includes('complementari');
}

/** Texto plano de una celda de ExcelJS (soporta string, número, fórmula, fecha, richText). */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) {
    // ExcelJS convierte seriales de hora de Excel (base 1899-12-30) a Date UTC.
    // Los detectamos por año 1899 y los formateamos como "H:MM" igual que el desplegable.
    if (value.getUTCFullYear() === 1899) {
      const h = value.getUTCHours();
      const m = value.getUTCMinutes();
      return `${h}:${m.toString().padStart(2, '0')}`;
    }
    return value.toISOString();
  }
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if ('text' in v && typeof v.text === 'string') return v.text.trim();
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as { text: string }[]).map(r => r.text).join('').trim();
    }
    // Fórmula con error (p. ej. { error: '#VALUE!' }) u objeto sin texto
    // legible: no hay texto aprovechable → cadena vacía. Evita que se cuele
    // un "[object Object]" en el almacén y, de ahí, al Excel regenerado.
    return '';
  }
  return String(value).trim();
}

/** Localiza el índice de columna (1-based) cuya cabecera coincide con alguna de las claves. */
function findCol(headers: Map<string, number>, ...claves: string[]): number | null {
  for (const c of claves) {
    const idx = headers.get(norm(c));
    if (idx) return idx;
  }
  return null;
}

/**
 * Etiquetas normalizadas de las columnas técnicas del Excel que NO son campos del informe:
 * las 9 columnas de horario y la columna ID compuesto.
 */
const H_LABELS_NORM = new Set([
  'id',
  'profesor', 'grupo', 'aula',
  'dia 1', 'entrada 1', 'salida 1',
  'dia 2', 'entrada 2', 'salida 2',
]);

/**
 * Lee los encabezados de la hoja "Horarios" de un Excel relleno y devuelve las
 * claves (CampoKey) de las columnas del informe en el orden en que aparecen.
 * Las 9 columnas de horario (Profesor, Aula, Grupo…) se excluyen automáticamente.
 *
 * Se usa para detectar y guardar el FormatoHorarios cuando el usuario carga
 * un Excel relleno en la pestaña Horarios y aún no había formato establecido.
 */
export async function extraerCamposInforme(base64: string): Promise<string[]> {
  const labelToKey = new Map<string, string>();
  for (const c of [...CAMPOS_META, ...CAMPOS_ASIGNATURA]) {
    labelToKey.set(norm(c.label), c.key);
  }

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as any);

  const ws = wb.getWorksheet('Horarios') ?? wb.worksheets[0];
  if (!ws) return [];

  const campos: string[] = [];
  ws.getRow(1).eachCell((cell) => {
    const txt = norm(cellText(cell.value));
    if (!txt || H_LABELS_NORM.has(txt)) return;
    const key = labelToKey.get(txt);
    if (key && !campos.includes(key)) campos.push(key);
  });

  return campos;
}

/**
 * Lee un Excel de horarios YA RELLENO (base64 del archivo .xlsx) y agrupa las clases
 * por alumno. Localiza las columnas por el TEXTO de su cabecera (fila 1 de la hoja
 * "Horarios"), de modo que funciona aunque cambie el orden o el conjunto de columnas
 * del informe con el que se generó.
 */
export async function parseHorariosExcel(
  base64: string,
  fileName: string,
): Promise<CargaHorarios> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as any);

  const ws = wb.getWorksheet('Horarios') ?? wb.worksheets[0];
  if (!ws) {
    throw new Error('El archivo no contiene una hoja de horarios legible.');
  }

  // ── Cabeceras (fila 1) → índice de columna ──────────────────────────────
  const headers = new Map<string, number>();
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, col) => {
    const txt = norm(cellText(cell.value));
    if (txt && !headers.has(txt)) headers.set(txt, col);
  });

  const cProf = findCol(headers, 'Profesor');
  if (!cProf) {
    throw new Error(
      'No se encuentra la columna "Profesor". ¿Seguro que es el Excel de horarios generado por la app?',
    );
  }
  const cAula = findCol(headers, 'Aula');
  const cGrupo = findCol(headers, 'Grupo');
  const cDia1 = findCol(headers, 'Día 1', 'Dia 1');
  const cEnt1 = findCol(headers, 'Entrada 1');
  const cSal1 = findCol(headers, 'Salida 1');
  const cDia2 = findCol(headers, 'Día 2', 'Dia 2');
  const cEnt2 = findCol(headers, 'Entrada 2');
  const cSal2 = findCol(headers, 'Salida 2');

  const cId = findCol(headers, 'ID');
  const cEmail = findCol(headers, 'Email', 'Correo', 'Correo electrónico');
  const cNomComp = findCol(headers, 'Nombre Completo', 'Alumno', 'Alumno/a');
  const cApellidos = findCol(headers, 'Apellidos');
  const cNombre = findCol(headers, 'Nombre');
  const cAsig = findCol(headers, 'Asignatura');
  const cEns = findCol(headers, 'Enseñanza / Curso', 'Enseñanza y Curso', 'Enseñanza/Curso');
  const cEsp = findCol(headers, 'Especialidad', 'Instrumento');

  const txt = (row: ExcelJS.Row, col: number | null): string =>
    col ? cellText(row.getCell(col).value) : '';

  const nombreDe = (row: ExcelJS.Row): string => {
    const completo = txt(row, cNomComp);
    if (completo) return completo;
    const ap = txt(row, cApellidos);
    const no = txt(row, cNombre);
    return [ap, no].filter(Boolean).join(', ');
  };

  // ── Recorrido de filas ──────────────────────────────────────────────────
  const mapa = new Map<string, HorarioAlumno>();
  let incompletas = 0;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // cabecera

    const email = txt(row, cEmail).toLowerCase();
    const nombre = nombreDe(row);
    const ensenanzaCurso = txt(row, cEns);
    const especialidad = txt(row, cEsp);

    // Clave única por alumno: nombre + enseñanza/curso + especialidad.
    // El email NO es clave porque dos hermanos pueden compartir correo
    // pero son alumnos distintos y deben recibir horarios separados.
    const claveBase = norm(nombre) + '|||' + norm(ensenanzaCurso) + '|||' + norm(especialidad);
    if (!norm(nombre)) return; // fila vacía, sin alumno

    // El profesor puede faltar (aún no asignado): la clase se mantiene igual,
    // mostrando "Sin Asignar" en vez de descartar la fila por completo.
    const profesor = txt(row, cProf) || 'Sin Asignar';

    let alumno = mapa.get(claveBase);
    if (!alumno) {
      alumno = {
        clave: claveBase,
        nombre,
        email,
        ensenanzaCurso,
        especialidad,
        clases: [],
      };
      mapa.set(claveBase, alumno);
    }

    const asignatura = txt(row, cAsig) || 'Clase';
    const aula = txt(row, cAula);
    const grupo = txt(row, cGrupo);
    const idAlumnoAsignatura = cId ? txt(row, cId) || undefined : undefined;

    // El profesor de Instrumento se guarda aparte aunque esta fila todavía no
    // tenga día/hora (así el email puede mostrar el Tutor/a igualmente).
    if (esAsignaturaTutoraInstrumento(asignatura) && !alumno.profesorInstrumento) {
      alumno.profesorInstrumento = profesor;
    }

    const addTramo = (dia: string, entrada: string, salida: string) => {
      if (!dia || !entrada || !salida) return false;
      const clase: ClaseHorario = { idAlumnoAsignatura, asignatura, profesor, aula, grupo, dia, entrada, salida };
      alumno!.clases.push(clase);
      return true;
    };

    // Tramo 1 es obligatorio cuando hay profesor; tramo 2 es opcional.
    const ok1 = addTramo(txt(row, cDia1), txt(row, cEnt1), txt(row, cSal1));
    if (!ok1) incompletas++;
    addTramo(txt(row, cDia2), txt(row, cEnt2), txt(row, cSal2));
  });

  const alumnos = Array.from(mapa.values())
    .filter(a => a.clases.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return { fileName, alumnos, incompletas };
}
