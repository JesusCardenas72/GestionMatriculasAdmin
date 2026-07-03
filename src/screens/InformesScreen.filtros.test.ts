import { describe, it, expect } from 'vitest';
import { aplicarFiltros, describeFiltro, esFiltroActivo, parseListaValor } from './InformesScreen';
import type { FilaInforme, FiltroInforme } from '../api/types';
import { ESTADO } from '../api/types';

// Fila mínima con los campos que tocamos en los tests (el resto, valores neutros).
function fila(over: Partial<FilaInforme>): FilaInforme {
  return {
    rowId: crypto.randomUUID(),
    nOrden: null,
    nombreMatricula: '',
    nombre: '',
    apellidos: '',
    dni: '',
    email: '',
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: '',
    createdon: '',
    modifiedon: '',
    cursoEscolar: '25/26',
    ensenanzaCurso: 'EP1',
    especialidad: 'Piano',
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    estado: ESTADO.TRAMITADO,
    docFaltante: null,
    repetidor: false,
    ...over,
  };
}

const lista = (campo: FiltroInforme['campo'], valores: string[]): FiltroInforme => ({
  id: crypto.randomUUID(),
  campo,
  operador: 'en_lista',
  valor: JSON.stringify(valores),
});

describe('parseListaValor', () => {
  it('devuelve el array serializado', () => {
    expect(parseListaValor(JSON.stringify(['Piano', 'Violín']))).toEqual(['Piano', 'Violín']);
  });
  it('tolera valores no válidos devolviendo []', () => {
    expect(parseListaValor('no-json')).toEqual([]);
    expect(parseListaValor('123')).toEqual([]);
  });
});

describe('aplicarFiltros — operador en_lista', () => {
  const filas = [
    fila({ especialidad: 'Piano' }),
    fila({ especialidad: 'Violín' }),
    fila({ especialidad: 'Guitarra' }),
  ];

  it('conserva solo las filas cuyo valor está en la lista', () => {
    const r = aplicarFiltros(filas, [lista('especialidad', ['Piano', 'Violín'])]);
    expect(r.map(f => f.especialidad)).toEqual(['Piano', 'Violín']);
  });

  it('lista vacía no filtra: se muestran todas las filas', () => {
    expect(aplicarFiltros(filas, [lista('especialidad', [])])).toHaveLength(filas.length);
  });

  it('casa contra el valor MOSTRADO de un booleano (Sí/No)', () => {
    const bools = [
      fila({ autorizacionImagen: true }),
      fila({ autorizacionImagen: false }),
    ];
    const r = aplicarFiltros(bools, [lista('autorizacionImagen', ['Sí'])]);
    expect(r).toHaveLength(1);
    expect(r[0].autorizacionImagen).toBe(true);
  });

  it('casa contra la etiqueta de un estado, no contra su código', () => {
    const estados = [
      fila({ estado: ESTADO.TRAMITADO }),
      fila({ estado: ESTADO.PENDIENTE_TRAMITACION }),
    ];
    const r = aplicarFiltros(estados, [lista('estado', ['Tramitado'])]);
    expect(r).toHaveLength(1);
    expect(r[0].estado).toBe(ESTADO.TRAMITADO);
  });

  it('los valores vacíos se representan como "—" y se pueden filtrar', () => {
    const conVacio = [fila({ especialidad: 'Piano' }), fila({ especialidad: null as unknown as string })];
    const r = aplicarFiltros(conVacio, [lista('especialidad', ['—'])]);
    expect(r).toHaveLength(1);
    expect(r[0].especialidad).toBeNull();
  });

  it('se combina (Y) con una condición del sistema anterior', () => {
    const r = aplicarFiltros(filas, [
      lista('especialidad', ['Piano', 'Violín', 'Guitarra']),
      { id: 'c1', campo: 'especialidad', operador: 'contiene', valor: 'o' }, // Piano, Violín (Guitarra no tiene "o")
    ]);
    expect(r.map(f => f.especialidad).sort()).toEqual(['Piano', 'Violín']);
  });
});

describe('esFiltroActivo', () => {
  it('lista con selección es activo; lista vacía no', () => {
    expect(esFiltroActivo(lista('especialidad', ['Piano']))).toBe(true);
    expect(esFiltroActivo(lista('especialidad', []))).toBe(false);
  });

  it('condición con valor es activa; sin valor no', () => {
    expect(esFiltroActivo({ id: 'a', campo: 'especialidad', operador: 'igual', valor: 'Piano' })).toBe(true);
    expect(esFiltroActivo({ id: 'b', campo: 'especialidad', operador: 'igual', valor: '' })).toBe(false);
    expect(esFiltroActivo({ id: 'c', campo: 'especialidad', operador: 'contiene', valor: '   ' })).toBe(false);
  });

  it('operadores sin valor (Sí/No, vacío…) son siempre activos', () => {
    expect(esFiltroActivo({ id: 'd', campo: 'autorizacionImagen', operador: 'es_true', valor: '' })).toBe(true);
    expect(esFiltroActivo({ id: 'e', campo: 'email', operador: 'no_vacio', valor: '' })).toBe(true);
  });
});

describe('describeFiltro — en_lista', () => {
  it('resume los primeros valores y cuenta el resto', () => {
    const d = describeFiltro(lista('especialidad', ['Piano', 'Violín', 'Guitarra', 'Flauta']));
    expect(d).toBe('Especialidad: Piano, Violín +2');
  });
  it('muestra (ninguno) cuando la lista está vacía', () => {
    expect(describeFiltro(lista('especialidad', []))).toBe('Especialidad: (ninguno)');
  });
  it('traduce "—" a (vacías)', () => {
    expect(describeFiltro(lista('especialidad', ['—']))).toBe('Especialidad: (vacías)');
  });
});
