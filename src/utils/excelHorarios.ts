import ExcelJS from 'exceljs';
import JSZip from 'jszip';
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
import { esValorHorarioUtil } from './fusionHorarios';
import { idCompuesto as calcIdCompuesto } from './asigId';

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
    // Columnas E y F son HorasEntrada/HorasSalida: forzamos formato texto para
    // evitar que Excel auto-convierta "9:00" o "18:30" a serial de tiempo.
    const esHora = letra === 'E' || letra === 'F';
    col.valores.forEach((v, j) => {
      const cell = listas.getCell(`${letra}${j + 2}`);
      cell.value = v;
      if (esHora) cell.numFmt = '@';
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

  // Columna ID: primera columna, bloqueada, oculta. Identificador único fila/asignatura.
  const colId: ColDef = { header: 'ID', key: 'id_compuesto', width: 12, editable: false };

  // Columnas auxiliares OCULTAS para la alarma de «choque de horario por alumno».
  //   k_alu → clave del alumno (compartida por todas sus filas/asignaturas).
  //   k_e1/k_s1/k_e2/k_s2 → horas de entrada/salida de cada tramo convertidas a
  //   número (fracción de día) por fórmula, para poder detectar solapes.
  // Van al final del todo; el usuario nunca las ve (se ocultan más abajo).
  const AUX_KEYS = ['k_alu', 'k_e1', 'k_s1', 'k_e2', 'k_s2'] as const;
  const colsAux: ColDef[] = AUX_KEYS.map(key => ({
    header: key,
    key,
    width: 10,
    editable: false,
  }));

  const COLS: ColDef[] = [colId, ...colsIzq, ...colsMid, ...colsDer, ...colsAux];

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
    h_dia1:
      'OBLIGATORIA cuando hay Profesor en la fila.\n' +
      'AVISO: si una celda se pone en AMARILLO con texto ROJO, este alumno tiene ' +
      'otra clase que se solapa con esta en el mismo día y hora.',
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

  // Columna ID oculta (primera columna): la columna se oculta a nivel de hoja.
  ws.getColumn('id_compuesto').hidden = true;
  // Columnas auxiliares (clave de alumno y horas numéricas): también ocultas.
  AUX_KEYS.forEach(k => { ws.getColumn(k).hidden = true; });

  // Clave que identifica al ALUMNO (compartida por todas sus filas/asignaturas).
  // Se usa nOrden como principal; el resto son respaldos por si faltara.
  const claveAlumnoDe = (f: FilaInforme): string =>
    String(f.nOrden ?? '').trim() ||
    (f.nombreCompleto ?? '').trim() ||
    (f.dni ?? '').trim() ||
    f.idAlumnoAsignatura ||
    calcIdCompuesto(f.nOrden, f.asigNombre ?? '');

  // Filas de datos (con los valores de horario heredados, si los hay)
  filas.forEach((f, idx) => {
    const row: Record<string, string> = {};
    // ID compuesto: identifica de forma única la fila matrícula × asignatura.
    row['id_compuesto'] = f.idAlumnoAsignatura ?? calcIdCompuesto(f.nOrden, f.asigNombre ?? '');
    // Clave de alumno (para la alarma de choque de horario).
    row['k_alu'] = claveAlumnoDe(f);
    colsDatos.forEach((c) => {
      if (c.campo) row[c.key] = formatValor(f, c.campo);
    });
    const h = valoresHorario?.[idx];
    if (h) {
      colsMid.forEach((c) => {
        const v = h[c.key];
        // Solo texto aprovechable: descarta valores no-string y restos de
        // cargas antiguas ("[object Object]") que ensuciarían la celda.
        if (esValorHorarioUtil(v)) {
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
        salCell.numFmt = '@';
      }
    }
  }

  // ── Horas de cada tramo en NÚMERO (columnas auxiliares ocultas) ──────────
  // Convierten el texto "H:MM" de las celdas de horario a fracción de día para
  // poder comparar solapes en el formato condicional (0 si la celda está vacía).
  // Se recalculan solas cuando el profesor cambia una hora.
  const numDe = (textoKey: string, r: number) =>
    `IF(${L(textoKey)}${r}<>"",TIMEVALUE(${L(textoKey)}${r}),0)`;
  const auxNum: [string, string][] = [
    ['k_e1', 'h_ent1'], ['k_s1', 'h_sal1'],
    ['k_e2', 'h_ent2'], ['k_s2', 'h_sal2'],
  ];
  for (let r = 2; r <= lastRow; r++) {
    for (const [auxKey, textoKey] of auxNum) {
      ws.getCell(r, colIdx[auxKey]).value = { formula: numDe(textoKey, r) };
    }
  }

  // Desplegables + protección por celda. Las filas de alumnos temporales
  // ("PDTE. N — …") se pintan en naranja para localizarlas de un vistazo.
  const TIME_KEYS = new Set(['h_ent1', 'h_sal1', 'h_ent2', 'h_sal2']);
  const filaEsTemporal = (r: number) => r - 2 < filas.length && !!filas[r - 2].esTemporal;
  for (let r = 2; r <= totalFilas + 1; r++) {
    const esTemp = filaEsTemporal(r);
    COLS.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1);
      if (c.editable && c.lista) {
        if (TIME_KEYS.has(c.key)) cell.numFmt = '@';
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [c.lista],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: 'Valor no permitido',
          error: 'Solo se puede elegir un valor de la lista desplegable.',
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

  // 4) CHOQUE DE HORARIO DEL MISMO ALUMNO → alarma (amarillo flúor + texto rojo
  //    en negrita). Salta cuando a un alumno se le solapan dos clases en el
  //    mismo día (aunque el solape sea parcial). Usa las columnas auxiliares
  //    ocultas (k_alu identifica al alumno; k_e1..k_s2 son las horas en número).
  //    Dos intervalos [a1,b1] y [a2,b2] se solapan si a1<b2 y a2<b1. SUMPRODUCT
  //    funciona en Excel clásico (no requiere M365).
  const alarmaChoque = {
    fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFFF00' } },
    font: { bold: true, color: { argb: 'FFFF0000' } },
  } as const;
  const rngAbs = (k: string) => `$${L(k)}$2:$${L(k)}$${lastRow}`;
  const curAbs = (k: string) => `$${L(k)}2`;
  // diaCur/eCur/sCur = tramo actual; *Same = el MISMO tramo de las demás filas
  // (excluye la propia fila); *Cross = el OTRO tramo de cualquier fila (no la
  // excluye, para detectar también el solape entre el tramo 1 y el 2 de la misma fila).
  const formulaChoque = (
    diaCur: string, eCur: string, sCur: string,
    diaSame: string, eSame: string, sSame: string,
    diaCross: string, eCross: string, sCross: string,
  ) =>
    `AND(${curAbs(diaCur)}<>"",${curAbs(eCur)}>0,${curAbs(sCur)}>0,` +
    `SUMPRODUCT((${rngAbs('k_alu')}=${curAbs('k_alu')})*(` +
    `(${rngAbs(diaSame)}=${curAbs(diaCur)})*(${rngAbs(eSame)}<${curAbs(sCur)})*(${curAbs(eCur)}<${rngAbs(sSame)})*(ROW(${rngAbs('k_alu')})<>ROW())` +
    `+(${rngAbs(diaCross)}=${curAbs(diaCur)})*(${rngAbs(eCross)}<${curAbs(sCur)})*(${curAbs(eCur)}<${rngAbs(sCross)})` +
    `))>0)`;

  // Tramo 1 → resalta Día 1, Entrada 1 y Salida 1 (columnas contiguas)
  ws.addConditionalFormatting({
    ref: `${L('h_dia1')}2:${L('h_sal1')}${lastRow}`,
    rules: [{
      type: 'expression', priority: 3,
      formulae: [formulaChoque(
        'h_dia1', 'k_e1', 'k_s1',
        'h_dia1', 'k_e1', 'k_s1',
        'h_dia2', 'k_e2', 'k_s2',
      )],
      style: alarmaChoque,
    }],
  });
  // Tramo 2 → resalta Día 2, Entrada 2 y Salida 2 (columnas contiguas)
  ws.addConditionalFormatting({
    ref: `${L('h_dia2')}2:${L('h_sal2')}${lastRow}`,
    rules: [{
      type: 'expression', priority: 4,
      formulae: [formulaChoque(
        'h_dia2', 'k_e2', 'k_s2',
        'h_dia2', 'k_e2', 'k_s2',
        'h_dia1', 'k_e1', 'k_s1',
      )],
      style: alarmaChoque,
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

  // ── base64 ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();

  // Ocultar la barra de fórmulas del libro: ExcelJS no expone esta opción,
  // así que se retoca directamente el XML interno (xl/workbook.xml) tras
  // generar el archivo. Así los profesores solo ven el desplegable de la
  // celda y no la barra donde podrían escribir cualquier texto.
  const zip = await JSZip.loadAsync(buffer);
  const workbookXmlPath = 'xl/workbook.xml';
  const workbookXmlFile = zip.file(workbookXmlPath);
  if (workbookXmlFile) {
    const xml = await workbookXmlFile.async('string');
    let xmlSinBarraFormulas: string;
    if (/<workbookView[^>]*>/.test(xml)) {
      // Ya hay <workbookView>: se añade o sustituye el atributo.
      xmlSinBarraFormulas = /showFormulaBar=/.test(xml)
        ? xml.replace(/showFormulaBar="[^"]*"/, 'showFormulaBar="0"')
        : xml.replace('<workbookView ', '<workbookView showFormulaBar="0" ');
    } else {
      // No hay <bookViews>/<workbookView> (caso normal): el esquema OOXML
      // exige que <bookViews> vaya justo antes de <sheets>, así que se
      // inserta ahí (insertarlo tras la etiqueta raíz dejaría el XML en
      // un orden inválido y Excel repararía o rechazaría el archivo).
      xmlSinBarraFormulas = xml.replace(
        '<sheets>',
        '<bookViews><workbookView showFormulaBar="0"/></bookViews><sheets>',
      );
    }
    zip.file(workbookXmlPath, xmlSinBarraFormulas);
  }
  const bufferFinal = await zip.generateAsync({ type: 'uint8array' });

  const bytes = bufferFinal;
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
