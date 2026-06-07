import ExcelJS from 'exceljs';
import type { CargaHorarios, ClaseHorario, HorarioAlumno } from '../horarios/types';

/** Quita acentos, espacios sobrantes y pasa a minúsculas para comparar cabeceras. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Texto plano de una celda de ExcelJS (soporta string, número, fórmula, fecha, richText). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if ('text' in v && typeof v.text === 'string') return v.text.trim();
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as { text: string }[]).map(r => r.text).join('').trim();
    }
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
 * Lee un Excel de horarios YA RELLENO (base64 del archivo .xlsx) y agrupa las clases
 * por alumno. Localiza las columnas por el TEXTO de su cabecera (fila 1 de la hoja
 * "Horarios"), de modo que funciona aunque cambie el orden o el conjunto de columnas
 * del informe con el que se generó.
 */
export async function parseHorariosExcel(
  base64: string,
  fileName: string,
): Promise<CargaHorarios> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes);

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
    const profesor = txt(row, cProf);
    if (!profesor) return; // sin profesor → fila sin clase asignada

    const email = txt(row, cEmail).toLowerCase();
    const nombre = nombreDe(row);
    const clave = email || norm(nombre);
    if (!clave) return;

    let alumno = mapa.get(clave);
    if (!alumno) {
      alumno = {
        clave,
        nombre,
        email,
        ensenanzaCurso: txt(row, cEns),
        especialidad: txt(row, cEsp),
        clases: [],
      };
      mapa.set(clave, alumno);
    }

    const asignatura = txt(row, cAsig) || 'Clase';
    const aula = txt(row, cAula);
    const grupo = txt(row, cGrupo);

    const addTramo = (dia: string, entrada: string, salida: string) => {
      if (!dia || !entrada || !salida) return false;
      const clase: ClaseHorario = { asignatura, profesor, aula, grupo, dia, entrada, salida };
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
