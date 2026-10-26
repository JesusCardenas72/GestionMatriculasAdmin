import { buildFilasNotasAnteriores } from './informeNotasAnteriores';
import type { LecturaNotas } from './becasNotas';

const lectura: LecturaNotas = {
  anno: '2025',
  avisos: [],
  matriculas: [
    {
      id: 'M1',
      apellidos: 'García López',
      nombre: 'Ana',
      ensenanza: 'Profesional',
      curso: 5,
      especialidad: 'Clarinete',
      asignaturas: [
        { codigo: 'A1', nombre: 'Clarinete', subgrupo: 'Matriculada', ordinaria: 8, extraordinaria: null },
        { codigo: 'A2', nombre: 'Armonía', subgrupo: 'Matriculada', ordinaria: 3, extraordinaria: 6 },
        { codigo: 'A3', nombre: 'Coro', subgrupo: 'Matriculada', ordinaria: 'NP', extraordinaria: 'NP' },
        { codigo: 'A4', nombre: 'Lenguaje', subgrupo: 'Ya superada', ordinaria: null, extraordinaria: null },
      ],
    },
  ],
};

describe('buildFilasNotasAnteriores', () => {
  it('sin archivo cargado no da filas', () => {
    expect(buildFilasNotasAnteriores(null)).toEqual([]);
  });

  it('da una fila por alumno y asignatura con su nota final', () => {
    const filas = buildFilasNotasAnteriores(lectura);
    expect(filas).toHaveLength(4);
    const [clarinete, armonia, coro, lenguaje] = filas;
    expect(clarinete.na_nombreCompleto).toBe('García López, Ana');
    expect(clarinete.na_ensenanzaCurso).toBe('EP5');
    expect(clarinete.na_notaFinal).toBe(8);
    expect(clarinete.na_superada).toBe(true);
    // La Extraordinaria manda si es numérica.
    expect(armonia.na_notaFinal).toBe(6);
    expect(armonia.na_superada).toBe(true);
    expect(coro.na_notaFinal).toBe('NP');
    expect(coro.na_superada).toBe(false);
    expect(lenguaje.na_notaFinal).toBeNull();
    expect(lenguaje.na_superada).toBeNull();
  });

  it('repite el resumen de la matrícula en cada asignatura', () => {
    const filas = buildFilasNotasAnteriores(lectura);
    for (const f of filas) {
      expect(f.na_matriculadas).toBe(3);
      expect(f.na_suspensas).toBe(1);
      // (8 + 6 + 2,5) / 3 = 5,5
      expect(f.na_media).toBe(5.5);
    }
    expect(new Set(filas.map(f => f.rowId)).size).toBe(4);
  });
});
