import ExcelJS from 'exceljs';
import type { FilaInforme } from '../api/types';
import {
  ESTADO_ASIGNATURA_LABELS,
  ESTADO_TRAMITE_LABELS,
  type CampoMeta,
} from '../data/informesConfig';
import {
  AULAS,
  DIAS,
  GRUPOS,
  HORAS_ENTRADA,
  HORAS_SALIDA,
} from '../data/horariosListas';

/**
 * Opciones configurables (desde el modal) para generar el Excel de horarios.
 */
export interface OpcionesHorario {
  /** Si se dejan columnas fijas (congeladas) a la izquierda al desplazar. */
  congelar: boolean;
  /** Clave del último campo del informe que queda fijo (incluido). */
  congelarHasta: string | null;
  /**
   * Clave del campo del informe tras el cual se insertan las columnas de
   * horario (Profesor, Aula, Grupo…). `null` = insertarlas al principio.
   */
  insertarTras: string | null;
}

/** Convierte un índice de columna (1 = A, 2 = B, …) a su letra de Excel. */
function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Formatea el valor de una celda académica/contacto igual que en el informe. */
function formatValor(fila: FilaInforme, campo: CampoMeta): string {
  const val = fila[campo.key as keyof FilaInforme];
  if (val === null || val === undefined) return '';
  if (campo.tipo === 'booleano') return val ? 'Sí' : 'No';
  if (campo.tipo === 'estado') return ESTADO_TRAMITE_LABELS[val as number] ?? String(val);
  if (campo.tipo === 'estado_asignatura')
    return ESTADO_ASIGNATURA_LABELS[val as number] ?? String(val);
  if (campo.tipo === 'fecha') {
    const str = String(val).split('T')[0];
    const [y, m, d] = str.split('-');
    return d && m && y ? `${d}/${m}/${y}` : str;
  }
  return String(val);
}

/** Ancho de columna (en caracteres) que se ajusta al contenido y a la cabecera. */
function anchoAjustado(header: string, valores: string[], extra = 2): number {
  const maxLen = valores.reduce((m, v) => Math.max(m, v.length), header.length);
  return Math.min(Math.max(maxLen + extra, 8), 48);
}

/**
 * Ancho de una columna con desplegable. Se ajusta SOLO al contenido de la lista
 * (no a la cabecera, que se muestra en dos líneas gracias al ajuste de texto),
 * con un mínimo pequeño. Así no queda hueco entre el texto y la barra del desplegable.
 */
function anchoDesplegable(valores: string[]): number {
  const maxLen = valores.reduce((m, v) => Math.max(m, v.length), 0);
  return Math.min(Math.max(maxLen + 2, 5), 36);
}

/**
 * Genera el Excel (.xlsx) de horarios a partir del informe que hay en pantalla.
 *
 *   IZQUIERDA → columnas del informe salvo las dos últimas, bloqueadas. Se congelan desde
 *               la primera columna hasta "Especialidad" para no perderlas al desplazar.
 *   CENTRO    → 9 columnas de horario con DESPLEGABLES (editables).
 *   DERECHA   → las dos últimas columnas del informe (email y teléfono), bloqueadas.
 *
 * @param filas      filas resultantes del informe
 * @param campos     columnas visibles del informe en pantalla (en su orden)
 * @param profesores lista de profesores (desde el CSV que elige el usuario)
 * @param opciones   configuración elegida en el modal (columnas fijas e inserción)
 * @param valoresHorario valores h_* a pre-rellenar por fila (alineado con `filas`);
 *                       lo usa la Fusión Actualización Nuevo Alumnado para conservar
 *                       lo que los profesores ya introdujeron
 */
export async function generarExcelHorarios(
  filas: FilaInforme[],
  campos: CampoMeta[],
  profesores: string[],
  opciones: OpcionesHorario,
  valoresHorario?: Array<Partial<Record<string, string>> | null>,
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GestiónMatrículas';
  wb.created = new Date();

  // ── Hoja oculta con las listas de los desplegables ──────────────────────
  const listas = wb.addWorksheet('Listas');
  listas.state = 'veryHidden';
  const columnasLista: { titulo: string; valores: string[] }[] = [
    { titulo: 'Profesores', valores: profesores },
    { titulo: 'Grupos', valores: GRUPOS },
    { titulo: 'Aulas', valores: AULAS },
    { titulo: 'Días', valores: DIAS },
    { titulo: 'HorasEntrada', valores: HORAS_ENTRADA },
    { titulo: 'HorasSalida', valores: HORAS_SALIDA },
  ];
  columnasLista.forEach((col, i) => {
    const letra = String.fromCharCode(65 + i);
    listas.getCell(`${letra}1`).value = col.titulo;
    col.valores.forEach((v, j) => {
      listas.getCell(`${letra}${j + 2}`).value = v;
    });
  });
  const rango = (letra: string, n: number) => `Listas!$${letra}$2:$${letra}$${Math.max(n, 1) + 1}`;

  // ── Columnas de horario (desplegables) ──────────────────────────────────
  const colsHorario = [
    { header: 'Profesor', key: 'h_prof', lista: rango('A', profesores.length), valores: profesores },
    { header: 'Grupo', key: 'h_grupo', lista: rango('B', GRUPOS.length), valores: GRUPOS },
    { header: 'Aula', key: 'h_aula', lista: rango('C', AULAS.length), valores: AULAS },
    { header: 'Día 1', key: 'h_dia1', lista: rango('D', DIAS.length), valores: DIAS },
    { header: 'Entrada 1', key: 'h_ent1', lista: rango('E', HORAS_ENTRADA.length), valores: HORAS_ENTRADA },
    { header: 'Salida 1', key: 'h_sal1', lista: rango('F', HORAS_SALIDA.length), valores: HORAS_SALIDA },
    { header: 'Día 2', key: 'h_dia2', lista: rango('D', DIAS.length), valores: DIAS },
    { header: 'Entrada 2', key: 'h_ent2', lista: rango('E', HORAS_ENTRADA.length), valores: HORAS_ENTRADA },
    { header: 'Salida 2', key: 'h_sal2', lista: rango('F', HORAS_SALIDA.length), valores: HORAS_SALIDA },
  ];

  // ── Definición global de columnas: informe (en su orden) + horario al final
  type ColDef = {
    header: string;
    key: string;
    width: number;
    editable: boolean;
    lista?: string;
    campo?: CampoMeta;
  };

  const valoresColumna = (campo: CampoMeta) =>
    filas.map(f => formatValor(f, campo));

  const aColDef = (c: CampoMeta): ColDef => ({
    header: c.label,
    key: c.key,
    width: anchoAjustado(c.label, valoresColumna(c)),
    editable: false,
    campo: c,
  });

  // El informe se parte según la posición elegida en el modal: las columnas de
  // horario se insertan TRAS el campo `insertarTras` (incluido en la izquierda);
  // el resto del informe queda a la derecha. `null` = horario al principio.
  const insertIdx = opciones.insertarTras
    ? campos.findIndex(c => c.key === opciones.insertarTras)
    : -1;
  const corte = insertIdx >= 0 ? insertIdx + 1 : 0;
  const colsIzq: ColDef[] = campos.slice(0, corte).map(aColDef);
  const colsDer: ColDef[] = campos.slice(corte).map(aColDef);
  const colsDatos: ColDef[] = [...colsIzq, ...colsDer]; // para escribir las filas

  // Desplegables: se insertan ANTES de las dos últimas columnas (email/teléfono)
  const colsMid: ColDef[] = colsHorario.map(c => ({
    header: c.header,
    key: c.key,
    // Ancho ajustado al contenido del desplegable (la cabecera se parte en 2 líneas)
    width: anchoDesplegable(c.valores),
    editable: true,
    lista: c.lista,
  }));

  const COLS: ColDef[] = [...colsIzq, ...colsMid, ...colsDer];

  // ── Hoja principal "Horarios" ───────────────────────────────────────────
  // Congelar la cabecera (ySplit: 1) y, si se ha pedido, las columnas fijas de
  // la izquierda hasta el campo elegido (incluido).
  let xSplit = 0;
  if (opciones.congelar && opciones.congelarHasta) {
    const idxCongelar = COLS.findIndex(c => c.key === opciones.congelarHasta);
    xSplit = idxCongelar >= 0 ? idxCongelar + 1 : 0;
  }

  const ws = wb.addWorksheet('Horarios', {
    views: [{ state: 'frozen', xSplit, ySplit: 1 }],
  });
  ws.columns = COLS.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Cabecera
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 32;
  COLS.forEach((c, i) => {
    headerRow.getCell(i + 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: c.editable ? 'FF2E7D32' : 'FF455A64' },
    };
  });

  // ── Notas de ayuda en las cabeceras de las columnas de horario ───────────
  // Aparecen al pasar el ratón. Explican qué rellenar y qué es obligatorio.
  const NOTAS_HORARIO: Record<string, string> = {
    h_prof:
      'Escribe tu nombre en la fila del alumno/asignatura que impartes.\n' +
      'En cuanto pongas tu nombre, son OBLIGATORIAS: Aula, Día 1, Entrada 1 y Salida 1.',
    h_grupo: 'Opcional.',
    h_aula: 'OBLIGATORIA cuando hay Profesor en la fila.',
    h_dia1: 'OBLIGATORIA cuando hay Profesor en la fila.',
    h_ent1: 'OBLIGATORIA cuando hay Profesor en la fila. Debe ser anterior a la Salida 1.',
    h_sal1: 'OBLIGATORIA cuando hay Profesor en la fila. Debe ser posterior a la Entrada 1.',
    h_dia2: 'Opcional: solo si la clase tiene un segundo día.',
    h_ent2: 'Opcional: solo si hay un segundo día. Debe ser anterior a la Salida 2.',
    h_sal2: 'Opcional: solo si hay un segundo día. Debe ser posterior a la Entrada 2.',
  };
  COLS.forEach((c, i) => {
    const texto = NOTAS_HORARIO[c.key];
    if (texto) headerRow.getCell(i + 1).note = texto;
  });

  const totalFilas = Math.max(filas.length, 50);
  const lastRow = totalFilas + 1;
  const colIdx: Record<string, number> = {};
  COLS.forEach((c, i) => {
    colIdx[c.key] = i + 1;
  });
  const L = (key: string) => colLetter(colIdx[key]);

  // Filas de datos (con los valores de horario heredados, si los hay)
  filas.forEach((f, idx) => {
    const row: Record<string, string> = {};
    colsDatos.forEach((c) => {
      if (c.campo) row[c.key] = formatValor(f, c.campo);
    });
    const h = valoresHorario?.[idx];
    if (h) {
      colsMid.forEach((c) => {
        const v = h[c.key];
        // Solo texto aprovechable: descarta valores no-string y restos de
        // cargas antiguas ("[object Object]") que ensuciarían la celda.
        if (typeof v === "string" && v.trim() && v.trim() !== "[object Object]") {
          row[c.key] = v.trim();
        }
      });
    }
    ws.addRow(row);
  });

  // Auto-relleno Salida = Entrada + 1h (tope 21:00)
  // Solo si la celda de salida está vacía (sin valor pre-rellenado por fusión).
  const pares: [string, string][] = [
    ["h_ent1", "h_sal1"],
    ["h_ent2", "h_sal2"],
  ];
  for (let r = 2; r <= lastRow; r++) {
    for (const [entKey, salKey] of pares) {
      const salCell = ws.getCell(r, colIdx[salKey]);
      if (!salCell.value) {
        salCell.value = {
          formula:
            `IF(${L(entKey)}${r}<>"",` +
            `TEXT(MIN(TIMEVALUE(${L(entKey)}${r})+TIME(1,0,0),TIMEVALUE("21:00")),"H:MM"),"")`,
        };
      }
    }
  }

  // Desplegables + protección por celda. Las filas de alumnos temporales
  // ("PDTE. N — …") se pintan en naranja para localizarlas de un vistazo.
  const filaEsTemporal = (r: number) => r - 2 < filas.length && !!filas[r - 2].esTemporal;
  for (let r = 2; r <= totalFilas + 1; r++) {
    const esTemp = filaEsTemporal(r);
    COLS.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1);
      if (c.editable && c.lista) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [c.lista],
          showErrorMessage: true,
          errorStyle: 'warning',
          error: 'Elige un valor de la lista desplegable.',
        };
        cell.protection = { locked: false };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: esTemp ? 'FFFFF3E0' : 'FFF1F8E9' },
        };
      } else {
        cell.protection = { locked: true };
        if (esTemp) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
          cell.font = { italic: true, color: { argb: 'FF8D4E00' } };
        }
      }
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        right: { style: 'hair', color: { argb: 'FFEEEEEE' } },
      };
    });
  }

  // ── Avisos automáticos de errores (formato condicional, sin macros) ──────
  // Las horas son texto "H:MM"; se comparan con TIMEVALUE() para que el orden
  // sea correcto (si no, "9:00" sería mayor que "10:00" como texto).
  const rangoCol = (key: string) => `${L(key)}2:${L(key)}${lastRow}`;
  const fillRojo = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } } } as const;
  const fillAmbar = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } } } as const;
  const fillNaranja = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFD8A8' } } } as const;

  // 1) Salida anterior o igual a la entrada → rojo (tramos 1 y 2)
  ws.addConditionalFormatting({
    ref: rangoCol('h_sal1'),
    rules: [{
      type: 'expression', priority: 1,
      formulae: [`AND($${L('h_ent1')}2<>"",$${L('h_sal1')}2<>"",TIMEVALUE($${L('h_sal1')}2)<=TIMEVALUE($${L('h_ent1')}2))`],
      style: fillRojo,
    }],
  });
  ws.addConditionalFormatting({
    ref: rangoCol('h_sal2'),
    rules: [{
      type: 'expression', priority: 2,
      formulae: [`AND($${L('h_ent2')}2<>"",$${L('h_sal2')}2<>"",TIMEVALUE($${L('h_sal2')}2)<=TIMEVALUE($${L('h_ent2')}2))`],
      style: fillRojo,
    }],
  });

  // 2) Fila incompleta: hay Profesor pero falta una columna OBLIGATORIA → ámbar.
  //    Obligatorias: Aula, Día 1, Entrada 1, Salida 1 (Grupo y tramo 2 son opcionales).
  ['h_aula', 'h_dia1', 'h_ent1', 'h_sal1'].forEach((key, k) => {
    ws.addConditionalFormatting({
      ref: rangoCol(key),
      rules: [{
        type: 'expression', priority: 10 + k,
        formulae: [`AND($${L('h_prof')}2<>"",${L(key)}2="")`],
        style: fillAmbar,
      }],
    });
  });

  // 3) Posible doble reserva: mismo Profesor, mismo Día 1 y misma Entrada 1 en
  //    más de una fila → naranja en la Entrada 1.
  ws.addConditionalFormatting({
    ref: rangoCol('h_ent1'),
    rules: [{
      type: 'expression', priority: 20,
      formulae: [
        `AND($${L('h_prof')}2<>"",$${L('h_dia1')}2<>"",$${L('h_ent1')}2<>"",` +
        `COUNTIFS($${L('h_prof')}$2:$${L('h_prof')}$${lastRow},$${L('h_prof')}2,` +
        `$${L('h_dia1')}$2:$${L('h_dia1')}$${lastRow},$${L('h_dia1')}2,` +
        `$${L('h_ent1')}$2:$${L('h_ent1')}$${lastRow},$${L('h_ent1')}2)>1)`,
      ],
      style: fillNaranja,
    }],
  });

  // Proteger la hoja: solo editables las columnas de horario
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: false,
    formatRows: false,
    insertRows: false,
    deleteRows: false,
    sort: true,
    autoFilter: true,
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } };

  // ── Hoja auxiliar oculta "Calc" ─────────────────────────────────────────
  // Una fila por cada fila de datos de "Horarios". Calcula la DURACIÓN (en horas)
  // de cada tramo a partir de las horas de texto, resolviendo aquí el problema de
  // las celdas vacías. Las hojas de resumen suman desde aquí con SUMIFS/COUNTIFS.
  const calc = wb.addWorksheet('Calc');
  calc.state = 'veryHidden';
  // A Profesor · B Día1 · C Horas1 · D Día2 · E Horas2 · F Aula
  // G Entrada1 (nº) · H Salida1 (nº) · I Entrada2 (nº) · J Salida2 (nº)
  ['Profesor', 'Dia1', 'Horas1', 'Dia2', 'Horas2', 'Aula',
    'Ent1n', 'Sal1n', 'Ent2n', 'Sal2n'].forEach((h, i) => {
    calc.getCell(1, i + 1).value = h;
  });
  const H = (key: string, r: number) => `Horarios!$${L(key)}${r}`;
  const durFormula = (entKey: string, salKey: string, r: number) =>
    `IF(AND(${H(entKey, r)}<>"",${H(salKey, r)}<>""),` +
    `(TIMEVALUE(${H(salKey, r)})-TIMEVALUE(${H(entKey, r)}))*24,0)`;
  // Hora a número (fracción de día); "" si la celda está vacía.
  const numFormula = (key: string, r: number) =>
    `IF(${H(key, r)}<>"",TIMEVALUE(${H(key, r)}),"")`;
  for (let r = 2; r <= lastRow; r++) {
    calc.getCell(`A${r}`).value = { formula: `IF(${H('h_prof', r)}="","",${H('h_prof', r)})` };
    calc.getCell(`B${r}`).value = { formula: H('h_dia1', r) };
    calc.getCell(`C${r}`).value = { formula: durFormula('h_ent1', 'h_sal1', r) };
    calc.getCell(`D${r}`).value = { formula: H('h_dia2', r) };
    calc.getCell(`E${r}`).value = { formula: durFormula('h_ent2', 'h_sal2', r) };
    calc.getCell(`F${r}`).value = { formula: H('h_aula', r) };
    calc.getCell(`G${r}`).value = { formula: numFormula('h_ent1', r) };
    calc.getCell(`H${r}`).value = { formula: numFormula('h_sal1', r) };
    calc.getCell(`I${r}`).value = { formula: numFormula('h_ent2', r) };
    calc.getCell(`J${r}`).value = { formula: numFormula('h_sal2', r) };
  }
  // Rangos del Calc por columna (A..F)
  const cR = (col: string) => `Calc!$${col}$2:$${col}$${lastRow}`;

  // Estilo de cabecera de tabla reutilizable
  const cabeceraTabla = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF455A64' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  };
  const fmtHoras = '0.##'; // p. ej. 1,5  ·  3

  // ── Hoja "Horas profesor" ───────────────────────────────────────────────
  // Horas LECTIVAS por profesor y día + total semanal.
  const hp = wb.addWorksheet('Horas profesor');
  hp.getColumn(1).width = 30;
  for (let c = 2; c <= 7; c++) hp.getColumn(c).width = 12;
  hp.mergeCells('A1:G1');
  hp.getCell('A1').value = 'Horas lectivas por profesor y día (total semanal)';
  hp.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF1B1B24' } };
  hp.mergeCells('A2:G2');
  hp.getCell('A2').value =
    'Solo horas de clase. Las horas no lectivas (preparación, reuniones, jefatura, tutorías…) se añadirán más adelante.';
  hp.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF8A8A99' } };
  const hpHead = 4;
  ['Profesor', ...DIAS, 'Total semana'].forEach((t, i) => {
    const cell = hp.getCell(hpHead, i + 1);
    cell.value = t;
    cabeceraTabla(cell);
  });
  profesores.forEach((nombre, i) => {
    const r = hpHead + 1 + i;
    hp.getCell(`A${r}`).value = nombre;
    DIAS.forEach((dia, d) => {
      const cell = hp.getCell(r, 2 + d);
      cell.value = {
        formula:
          `SUMIFS(${cR('C')},${cR('A')},$A${r},${cR('B')},"${dia}")+` +
          `SUMIFS(${cR('E')},${cR('A')},$A${r},${cR('D')},"${dia}")`,
      };
      cell.numFmt = fmtHoras;
      cell.alignment = { horizontal: 'center' };
    });
    const tot = hp.getCell(r, 7);
    tot.value = { formula: `SUM(B${r}:F${r})` };
    tot.numFmt = fmtHoras;
    tot.font = { bold: true };
    tot.alignment = { horizontal: 'center' };
  });

  // ── Hoja "Horas aulas" ──────────────────────────────────────────────────
  // Por aula y día: nº de clases y horas; total de horas por semana.
  const ha = wb.addWorksheet('Horas aulas');
  ha.getColumn(1).width = 10;
  for (let c = 2; c <= 12; c++) ha.getColumn(c).width = 9;
  ha.mergeCells('A1:L1');
  ha.getCell('A1').value = 'Ocupación de aulas por día: nº de clases y horas (total semanal)';
  ha.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FF1B1B24' } };
  const haHead = 3;
  ha.getCell(haHead, 1).value = 'Aula';
  cabeceraTabla(ha.getCell(haHead, 1));
  DIAS.forEach((dia, d) => {
    const cClases = ha.getCell(haHead, 2 + d * 2);
    const cHoras = ha.getCell(haHead, 3 + d * 2);
    cClases.value = `${dia}\nclases`;
    cHoras.value = `${dia}\nhoras`;
    cabeceraTabla(cClases);
    cabeceraTabla(cHoras);
  });
  ha.getCell(haHead, 12).value = 'Total horas semana';
  cabeceraTabla(ha.getCell(haHead, 12));
  AULAS.forEach((aula, i) => {
    const r = haHead + 1 + i;
    ha.getCell(`A${r}`).value = aula;
    DIAS.forEach((dia, d) => {
      const cClases = ha.getCell(r, 2 + d * 2);
      cClases.value = {
        formula:
          `COUNTIFS(${cR('F')},$A${r},${cR('B')},"${dia}")+` +
          `COUNTIFS(${cR('F')},$A${r},${cR('D')},"${dia}")`,
      };
      cClases.alignment = { horizontal: 'center' };
      const cHoras = ha.getCell(r, 3 + d * 2);
      cHoras.value = {
        formula:
          `SUMIFS(${cR('C')},${cR('F')},$A${r},${cR('B')},"${dia}")+` +
          `SUMIFS(${cR('E')},${cR('F')},$A${r},${cR('D')},"${dia}")`,
      };
      cHoras.numFmt = fmtHoras;
      cHoras.alignment = { horizontal: 'center' };
    });
    const tot = ha.getCell(r, 12);
    tot.value = { formula: `C${r}+E${r}+G${r}+I${r}+K${r}` };
    tot.numFmt = fmtHoras;
    tot.font = { bold: true };
    tot.alignment = { horizontal: 'center' };
  });

  // ── Hojas de ocupación: una por día (Lunes…Viernes) ─────────────────────
  // Rejilla franja horaria (filas) × aula (columnas). Cada celda muestra el
  // profesor que ocupa esa aula en esa franja ese día. La franja [f, f+30min)
  // está ocupada si Entrada<=f y Salida>f (tramo 1 o tramo 2).
  // Requiere Excel moderno (M365) para la evaluación matricial de SUMPRODUCT/MAX.
  DIAS.forEach(dia => {
    const sh = wb.addWorksheet(dia);
    const headRow = 3;
    sh.getColumn(1).width = 8;
    AULAS.forEach((_, i) => { sh.getColumn(2 + i).width = 16; });

    // Título
    sh.mergeCells(1, 1, 1, AULAS.length + 1);
    sh.getCell(1, 1).value = `Ocupación de aulas — ${dia}`;
    sh.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF1B1B24' } };

    // Cabecera: Hora + aulas
    const hCell = sh.getCell(headRow, 1);
    hCell.value = 'Hora';
    cabeceraTabla(hCell);
    AULAS.forEach((aula, i) => {
      const cell = sh.getCell(headRow, 2 + i);
      cell.value = aula;
      cabeceraTabla(cell);
    });

    // Filas de franjas horarias
    HORAS_ENTRADA.forEach((franja, fi) => {
      const r = headRow + 1 + fi;
      sh.getCell(r, 1).value = franja;
      sh.getCell(r, 1).font = { bold: true };
      sh.getCell(r, 1).alignment = { horizontal: 'center' };
      AULAS.forEach((_, ai) => {
        const letra = colLetter(2 + ai);
        const aulaRef = `${letra}$${headRow}`;
        const f = `TIMEVALUE($A${r})`;
        const rowExpr =
          `SUMPRODUCT(MAX((${cR('F')}=${aulaRef})*(` +
          `(${cR('B')}="${dia}")*(${cR('G')}<=${f})*(${cR('H')}>${f})+` +
          `(${cR('D')}="${dia}")*(${cR('I')}<=${f})*(${cR('J')}>${f})` +
          `)*ROW(${cR('A')})))`;
        const cell = sh.getCell(r, 2 + ai);
        cell.value = { formula: `IF(${rowExpr}=0,"",INDEX(Calc!$A:$A,${rowExpr}))` };
        cell.alignment = { horizontal: 'center', wrapText: true };
        cell.font = { size: 9 };
      });
    });

    // Congelar la columna de horas y la cabecera
    sh.views = [{ state: 'frozen', xSplit: 1, ySplit: headRow }];
  });

  // ── base64 ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
