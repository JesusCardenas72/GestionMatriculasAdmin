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

/** Hasta qué campo se congelan las columnas de la izquierda (incluido). */
const CONGELAR_HASTA = 'especialidad';

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
 */
export async function generarExcelHorarios(
  filas: FilaInforme[],
  campos: CampoMeta[],
  profesores: string[],
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

  // El informe se parte: todo menos las DOS ÚLTIMAS columnas (email y teléfono)
  // va a la izquierda; esas dos quedan al final del Excel.
  const corte = Math.max(campos.length - 2, 0);
  const colsIzq: ColDef[] = campos.slice(0, corte).map(aColDef);
  const colsDer: ColDef[] = campos.slice(corte).map(aColDef); // email, teléfono
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
  // Congelar filas (cabecera) + columnas desde la primera hasta "Especialidad".
  const idxCongelar = colsIzq.findIndex(c => c.key === CONGELAR_HASTA);
  const xSplit = idxCongelar >= 0 ? idxCongelar + 1 : colsIzq.length;

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

  // Filas de datos
  filas.forEach(f => {
    const row: Record<string, string> = {};
    colsDatos.forEach(c => {
      if (c.campo) row[c.key] = formatValor(f, c.campo);
    });
    ws.addRow(row);
  });

  const totalFilas = Math.max(filas.length, 50);

  // Desplegables + protección por celda
  for (let r = 2; r <= totalFilas + 1; r++) {
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
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } };
      } else {
        cell.protection = { locked: true };
      }
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFCCCCCC' } },
        right: { style: 'hair', color: { argb: 'FFEEEEEE' } },
      };
    });
  }

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
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
