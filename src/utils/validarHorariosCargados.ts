import { H_KEYS, type FilaCrudaHorario, type HKey } from './fusionHorarios';
import { AULAS, DIAS, GRUPOS, HORAS_ENTRADA, HORAS_SALIDA } from '../data/horariosListas';

export const H_ETIQUETAS: Record<HKey, string> = {
  h_prof: 'Profesor',
  h_grupo: 'Grupo',
  h_aula: 'Aula',
  h_dia1: 'Día 1',
  h_ent1: 'Entrada 1',
  h_sal1: 'Salida 1',
  h_dia2: 'Día 2',
  h_ent2: 'Entrada 2',
  h_sal2: 'Salida 2',
};

export function listaValidaHKey(key: HKey, profesores: string[]): string[] {
  switch (key) {
    case 'h_prof': return profesores;
    case 'h_grupo': return GRUPOS;
    case 'h_aula': return AULAS;
    case 'h_dia1': case 'h_dia2': return DIAS;
    case 'h_ent1': case 'h_ent2': return HORAS_ENTRADA;
    case 'h_sal1': case 'h_sal2': return HORAS_SALIDA;
  }
}

export interface ErrorCampoHorario {
  key: HKey;
  label: string;
  valorInvalido: string;
  opciones: string[];
}

export interface FilaConErrorHorario {
  /** Índice en el array original de crudas (para aplicar las correcciones). */
  idx: number;
  fila: FilaCrudaHorario;
  errores: ErrorCampoHorario[];
}

/**
 * Compara los valores de las 9 columnas de horario de cada fila contra las
 * listas permitidas. Devuelve solo las filas que contienen al menos un valor
 * no vacío fuera de lista.
 */
export function validarFilasCrudas(
  crudas: FilaCrudaHorario[],
  profesores: string[],
): FilaConErrorHorario[] {
  const resultado: FilaConErrorHorario[] = [];

  crudas.forEach((fila, idx) => {
    const errores: ErrorCampoHorario[] = [];
    for (const key of H_KEYS) {
      const valor = fila.h[key];
      if (!valor) continue;
      const lista = listaValidaHKey(key, profesores);
      if (!lista.includes(valor)) {
        errores.push({
          key,
          label: H_ETIQUETAS[key],
          valorInvalido: valor,
          opciones: lista,
        });
      }
    }
    if (errores.length > 0) resultado.push({ idx, fila, errores });
  });

  return resultado;
}

/**
 * Aplica las correcciones del usuario sobre el array original de crudas.
 * `correcciones` es un mapa de idx → { key: valor corregido ('' = borrar) }.
 * Devuelve una copia nueva del array sin mutar el original.
 */
export function aplicarCorreccionesHorario(
  crudas: FilaCrudaHorario[],
  correcciones: Map<number, Partial<Record<HKey, string>>>,
): FilaCrudaHorario[] {
  return crudas.map((fila, idx) => {
    const corr = correcciones.get(idx);
    if (!corr) return fila;
    const h = { ...fila.h };
    for (const [k, v] of Object.entries(corr) as [HKey, string][]) {
      if (v === '') {
        delete h[k];
      } else {
        h[k] = v;
      }
    }
    return { ...fila, h };
  });
}
