/**
 * Lógica común de colocación de clases en la parrilla semanal, compartida por
 * los dos formatos de horario individual:
 *   - "clasico" → {@link buildHorarioHtml} (cabecera con logos, serif elegante)
 *   - "notas"   → {@link buildHorarioNotasHtml} (notas adhesivas, rotulador)
 *
 * Aquí vive todo lo que NO depende del estilo: parseo de horas, matriz de
 * ocupación [día][hora], rowspans, medias horas, huecos "sin clases" y el
 * resumen de horas por asignatura. Cada renderer pone encima su propia paleta
 * de colores y su maquetación.
 */
import { DIAS } from '../data/horariosListas';
import type { ClaseHorario, HorarioAlumno } from '../horarios/types';

export function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function aMin(h: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((h ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function aHHMM(min: number): string {
  return `${Math.floor(min / 60)}:${(min % 60).toString().padStart(2, '0')}`;
}

/** Total de minutos formateado como "Xh", "Xh Ymin" o "Ymin". */
export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/**
 * Pequeña rotación/desplazamiento determinista por nota, para el efecto de
 * "papel pegado a mano" (cada tarjeta queda ligeramente torcida pero estable).
 */
export function rotacion(seed: number, maxAng = 5, maxDx = 6, maxDy = 4): string {
  const ang = (((seed * 2654435761) % 1000) / 1000 - 0.5) * maxAng;
  const dx = (((seed * 40503) % 100) / 100 - 0.5) * maxDx;
  const dy = (((seed * 12289) % 100) / 100 - 0.5) * maxDy;
  return `transform:rotate(${ang.toFixed(1)}deg) translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px)`;
}

export interface OcupEntry {
  clase: ClaseHorario;
  position: 'full' | 'top' | 'bottom';
  rowspan: number;
}

export interface HourSlotData {
  full?: OcupEntry;
  top?: OcupEntry;
  bottom?: OcupEntry;
}

export type Slot = HourSlotData | 'cov' | undefined;

export interface HorarioGrid {
  /** Clases válidas (con entrada/salida correctas), con sus minutos. */
  conMin: { c: ClaseHorario; ini: number; fin: number }[];
  /** Resumen [asignatura, minutos] ordenado de más a menos horas. */
  asigResumen: [string, number][];
  totalMinutos: number;
  /** Nº de días distintos con clase. */
  nDias: number;
  /** Matriz de ocupación [día][hora]. */
  ocup: Slot[][];
  /** Minuto de inicio de cada fila horaria. */
  hourSlots: number[];
  nHours: number;
  /** Grupos de filas activas separadas por 'sep' (huecos "sin clases"). */
  groups: (number[] | 'sep')[];
}

/**
 * Construye la matriz de ocupación y el resumen de asignaturas a partir de las
 * clases del alumno. No emite HTML: devuelve solo datos.
 */
export function computeHorarioGrid(alumno: HorarioAlumno): HorarioGrid {
  const conMin = alumno.clases
    .map(c => ({ c, ini: aMin(c.entrada), fin: aMin(c.salida) }))
    .filter((x): x is { c: ClaseHorario; ini: number; fin: number } =>
      x.ini !== null && x.fin !== null && x.fin > x.ini,
    );

  // ── Resumen de asignaturas + horas semanales ──────────────────────────────
  const horasPorAsig = new Map<string, number>();
  for (const { c, ini, fin } of conMin) {
    horasPorAsig.set(c.asignatura, (horasPorAsig.get(c.asignatura) ?? 0) + (fin - ini));
  }
  const asigResumen = [...horasPorAsig.entries()].sort((a, b) => b[1] - a[1]);
  const totalMinutos = asigResumen.reduce((s, [, m]) => s + m, 0);
  const nDias = new Set(conMin.map(({ c }) => c.dia)).size;

  // ── Rango horario de la parrilla ──────────────────────────────────────────
  let gridIni = 9 * 60;
  let gridFin = 21 * 60;
  if (conMin.length) {
    gridIni = Math.floor(Math.min(...conMin.map(x => x.ini)) / 60) * 60;
    gridFin = Math.ceil(Math.max(...conMin.map(x => x.fin)) / 60) * 60;
  }
  const nHours = Math.max(1, (gridFin - gridIni) / 60);
  const hourSlots = Array.from({ length: nHours }, (_, i) => gridIni + i * 60);

  // ── Matriz de ocupación [día][hora] ───────────────────────────────────────
  const ocup: Slot[][] = DIAS.map(() => Array.from({ length: nHours }, (): Slot => undefined));

  conMin.forEach(({ c, ini, fin }) => {
    const d = DIAS.indexOf(c.dia);
    if (d < 0) return;
    const h = Math.floor((ini - gridIni) / 60);
    if (h < 0 || h >= nHours) return;

    const hourStart = gridIni + h * 60;
    const startsAtHalf = ini >= hourStart + 30;
    const duration = fin - ini;

    if (startsAtHalf) {
      // Empieza en la media hora: arranca en la mitad inferior de esta fila y se
      // extiende hacia abajo tantas filas como dure (no se aplasta en media celda).
      const prev = ocup[d][h];
      if (prev === 'cov') return;
      const data: HourSlotData = (prev as HourSlotData) ?? {};
      if (data.full || data.bottom) return;
      const endRow = Math.min(Math.floor((fin - 1 - gridIni) / 60), nHours - 1);
      let span = 1;
      for (let r = 1; r <= endRow - h; r++) {
        if (ocup[d][h + r] !== undefined) break;
        span = r + 1;
      }
      data.bottom = { clase: c, position: 'bottom', rowspan: span };
      ocup[d][h] = data;
      for (let r = 1; r < span; r++) ocup[d][h + r] = 'cov';
    } else if (duration <= 30) {
      // Mitad superior, rowspan 1.
      const prev = ocup[d][h];
      if (prev === 'cov') return;
      const data: HourSlotData = (prev as HourSlotData) ?? {};
      if (data.full || data.top) return;
      data.top = { clase: c, position: 'top', rowspan: 1 };
      ocup[d][h] = data;
    } else {
      // Celda completa, posible multi-fila.
      const rowspan = Math.min(Math.ceil(duration / 60), nHours - h);
      let free = true;
      for (let r = 0; r < rowspan; r++) {
        if (ocup[d][h + r] !== undefined) { free = false; break; }
      }
      if (!free) return;
      ocup[d][h] = { full: { clase: c, position: 'full', rowspan } };
      for (let r = 1; r < rowspan; r++) ocup[d][h + r] = 'cov';
    }
  });

  // ── Filas activas agrupadas con separadores "sin clases" ──────────────────
  const active = new Set<number>();
  for (let h = 0; h < nHours; h++) {
    for (let d = 0; d < DIAS.length; d++) {
      if (ocup[d][h] !== undefined) { active.add(h); break; }
    }
  }

  const groups: (number[] | 'sep')[] = [];
  let cur: number[] = [];
  for (let h = 0; h < nHours; h++) {
    if (active.has(h)) {
      cur.push(h);
    } else if (cur.length) {
      groups.push(cur);
      groups.push('sep');
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);

  return { conMin, asigResumen, totalMinutos, nDias, ocup, hourSlots, nHours, groups };
}

/**
 * Si una clase de celda completa termina a mitad de hora y abarca varias filas
 * (p. ej. 16:00–17:30), devuelve el `bottom` dinámico para que el bloque no
 * llegue al final de la última fila. Cadena vacía si no aplica.
 */
export function bottomOverridePct(entry: OcupEntry, pad = 4): string {
  const ini = aMin(entry.clase.entrada);
  const fin = aMin(entry.clase.salida);
  if (entry.position !== 'full' || ini === null || fin === null || fin % 60 === 0 || entry.rowspan <= 1) {
    return '';
  }
  const fillRatio = (fin - ini) / (entry.rowspan * 60);
  const pct = Math.round((1 - fillRatio) * 100);
  return `;bottom:calc(${pct}% + ${pad}px)`;
}
