import type { FilaInforme } from '../api/types';
import {
  cuentaComoMatriculada,
  notaFinal,
  NOTA_APROBADO,
  resumenCursoAnterior,
  type LecturaNotas,
} from './becasNotas';
import { BASE_SOLICITUD } from './informeProfesorado';

/**
 * Filas del informe en modo «notasAnterior»: una por alumno × asignatura del
 * archivo de notas del curso anterior (CSV de Delphos que se carga desde el
 * engranaje → «Notas del curso AA/AA»).
 *
 * Como `FilaInforme` es una matrícula ampliada, la parte de alumno va vacía
 * (igual que en el modo profesorado): este modo solo ofrece las columnas
 * `na_*`, así que esos huecos nunca llegan a verse.
 */
export function buildFilasNotasAnteriores(lectura: LecturaNotas | null | undefined): FilaInforme[] {
  if (!lectura) return [];
  const filas: FilaInforme[] = [];
  for (const m of lectura.matriculas) {
    const resumen = resumenCursoAnterior(m);
    const ens = m.ensenanza === 'Profesional' ? 'EP' : m.ensenanza === 'Elemental' ? 'EE' : '';
    const ensenanzaCurso = ens && m.curso ? `${ens}${m.curso}` : null;
    const suspensas = m.asignaturas.filter(a => {
      if (!cuentaComoMatriculada(a)) return false;
      const nota = notaFinal(a);
      return nota === 'NP' || (typeof nota === 'number' && nota < NOTA_APROBADO);
    }).length;
    const media = resumen.notaMedia === null ? null : Math.round(resumen.notaMedia * 100) / 100;
    const nombreCompleto = [m.apellidos, m.nombre].filter(Boolean).join(', ');
    for (const a of m.asignaturas) {
      const final = notaFinal(a);
      filas.push({
        ...BASE_SOLICITUD,
        rowId: `na_${m.id}_${a.codigo}`,
        nombre: m.nombre,
        apellidos: m.apellidos,
        ensenanzaCurso: ensenanzaCurso ?? '',
        especialidad: m.especialidad || null,
        na_apellidos: m.apellidos,
        na_nombre: m.nombre,
        na_nombreCompleto: nombreCompleto,
        na_matricula: m.id,
        na_ensenanzaCurso: ensenanzaCurso,
        na_especialidad: m.especialidad || null,
        na_asignatura: a.nombre,
        na_codigo: a.codigo,
        na_subgrupo: a.subgrupo || null,
        na_ordinaria: a.ordinaria,
        na_extraordinaria: a.extraordinaria,
        na_notaFinal: final,
        na_superada: final === null ? null : final !== 'NP' && final >= NOTA_APROBADO,
        na_matriculadas: resumen.nMatriculadas,
        na_suspensas: suspensas,
        na_media: media,
      });
    }
  }
  return filas;
}
