import { ESTADO, ESTADO_ASIGNATURA } from '../api/types';
import type { CampoKey, ConfigInforme, OperadorFiltro } from '../api/types';

export interface CampoMeta {
  key: CampoKey;
  label: string;
  tipo: 'texto' | 'booleano' | 'fecha' | 'numero' | 'estado' | 'estado_asignatura';
  /** El valor del filtro se elige de una lista derivada de los datos cargados */
  valorType?: 'select_data';
}

export const CAMPOS_META: CampoMeta[] = [
  { key: 'nOrden',               label: 'N.º Orden',          tipo: 'numero'   },
  { key: 'apellidos',            label: 'Apellidos',           tipo: 'texto'    },
  { key: 'nombre',               label: 'Nombre',              tipo: 'texto'    },
  { key: 'dni',                  label: 'DNI/NIE',             tipo: 'texto'    },
  { key: 'email',                label: 'Email',               tipo: 'texto'    },
  { key: 'telefono',             label: 'Teléfono',            tipo: 'texto'    },
  { key: 'fechaNacimiento',      label: 'F. Nacimiento',       tipo: 'fecha'    },
  { key: 'domicilio',            label: 'Domicilio',           tipo: 'texto'    },
  { key: 'localidad',            label: 'Localidad',           tipo: 'texto'    },
  { key: 'provincia',            label: 'Provincia',           tipo: 'texto'    },
  { key: 'cp',                   label: 'Cód. Postal',         tipo: 'texto'    },
  { key: 'fechaInscripcion',     label: 'F. Inscripción',      tipo: 'fecha'    },
  { key: 'ensenanzaCurso',       label: 'Enseñanza / Curso',   tipo: 'texto',   valorType: 'select_data' },
  { key: 'especialidad',         label: 'Especialidad',        tipo: 'texto',   valorType: 'select_data' },
  { key: 'formaPago',            label: 'Forma de Pago',       tipo: 'texto',   valorType: 'select_data' },
  { key: 'reduccionTasas',       label: 'Reducción Tasas',     tipo: 'texto',   valorType: 'select_data' },
  { key: 'autorizacionImagen',   label: 'Aut. Imagen',         tipo: 'booleano' },
  { key: 'disponibilidadManana', label: 'Disp. Mañana',        tipo: 'booleano' },
  { key: 'horaSalida',           label: 'Hora Salida',         tipo: 'texto'    },
  { key: 'estado',               label: 'Estado',              tipo: 'estado'   },
  { key: 'docFaltante',          label: 'Doc. Faltante',       tipo: 'texto'    },
  { key: 'ampliada',             label: 'Matrícula ampliada',  tipo: 'booleano' },
  { key: 'repetidor',            label: 'Repetidor',           tipo: 'booleano' },
];

// Campos específicos del modo "por asignatura" (una fila por alumno × asignatura)
export const CAMPOS_ASIGNATURA: CampoMeta[] = [
  { key: 'asigNombre',  label: 'Asignatura',         tipo: 'texto',            valorType: 'select_data' },
  { key: 'asigCodigo',  label: 'Código',             tipo: 'numero'   },
  { key: 'asigEstado',  label: 'Estado asignatura',  tipo: 'estado_asignatura' },
  { key: 'asigHorario', label: 'Horario',            tipo: 'texto'    },
];

export const CAMPO_MAP = new Map<CampoKey, CampoMeta>(
  [...CAMPOS_META, ...CAMPOS_ASIGNATURA].map(c => [c.key, c]),
);

/** Campos disponibles según el modo del informe. En modo asignatura se ofrecen también los del alumno. */
export function camposDeModo(modo: ConfigInforme['modo']): CampoMeta[] {
  return modo === 'asignatura' ? [...CAMPOS_ASIGNATURA, ...CAMPOS_META] : CAMPOS_META;
}

// ── Operadores por tipo ────────────────────────────────────────────────────────

export interface OperadorMeta {
  key: OperadorFiltro;
  label: string;
  needsValor: boolean;
}

const OPS_TEXTO: OperadorMeta[] = [
  { key: 'igual',    label: 'es igual a',      needsValor: true  },
  { key: 'contiene', label: 'contiene',         needsValor: true  },
  { key: 'distinto', label: 'es distinto de',   needsValor: true  },
  { key: 'vacio',    label: 'está vacío',        needsValor: false },
  { key: 'no_vacio', label: 'no está vacío',     needsValor: false },
];

const OPS_BOOLEANO: OperadorMeta[] = [
  { key: 'es_true',  label: 'es Sí',  needsValor: false },
  { key: 'es_false', label: 'es No',  needsValor: false },
];

const OPS_NUMERO: OperadorMeta[] = [
  { key: 'igual',       label: 'es igual a',           needsValor: true  },
  { key: 'mayor_que',   label: 'es mayor que',          needsValor: true  },
  { key: 'menor_que',   label: 'es menor que',          needsValor: true  },
  { key: 'mayor_igual', label: 'es mayor o igual que',  needsValor: true  },
  { key: 'menor_igual', label: 'es menor o igual que',  needsValor: true  },
  { key: 'vacio',       label: 'está vacío',             needsValor: false },
  { key: 'no_vacio',    label: 'no está vacío',          needsValor: false },
];

export function getOperadores(tipo: CampoMeta['tipo']): OperadorMeta[] {
  if (tipo === 'booleano') return OPS_BOOLEANO;
  if (tipo === 'numero')   return OPS_NUMERO;
  return OPS_TEXTO;
}

// ── Labels de estado ──────────────────────────────────────────────────────────

export const ESTADO_TRAMITE_LABELS: Record<number, string> = {
  [ESTADO.PENDIENTE_TRAMITACION]: 'Pendiente tramitación',
  [ESTADO.PENDIENTE_VALIDACION]:  'Pendiente validación',
  [ESTADO.TRAMITADO]:             'Tramitado',
};

export const ESTADO_ASIGNATURA_LABELS: Record<number, string> = {
  [ESTADO_ASIGNATURA.MATRICULADA]:             'Matriculada',
  [ESTADO_ASIGNATURA.SOLICITUD_CONVALIDACION]: 'Solicitud de Convalidación',
  [ESTADO_ASIGNATURA.CONVALIDADA]:             'Convalidada',
  [ESTADO_ASIGNATURA.SIMULTANEADA]:            'Simultaneada',
  [ESTADO_ASIGNATURA.PENDIENTE]:               'Pendiente',
};

// ── Configuraciones de informe ────────────────────────────────────────────────

export const INFORME_VACIO: ConfigInforme = {
  id: 'personalizado',
  nombre: 'Informe personalizado',
  camposVisibles: ['apellidos', 'nombre', 'ensenanzaCurso', 'email'],
  filtros: [],
  orden: [],
  agruparPor: null,
  modo: 'alumno',
};

export const INFORMES_PREDEFINIDOS: ConfigInforme[] = [
  {
    id: 'listado-especialidad',
    nombre: 'Listado por especialidad',
    descripcion: 'Alumnos de una especialidad, ordenados por enseñanza, curso y apellidos',
    predefinido: true,
    modo: 'alumno',
    camposVisibles: [
      'apellidos',
      'nombre',
      'ensenanzaCurso',
      'autorizacionImagen',
      'disponibilidadManana',
      'horaSalida',
      'email',
      'telefono',
    ],
    filtros: [
      { id: 'f1', campo: 'especialidad', operador: 'igual', valor: '' },
    ],
    orden: [
      { id: 'o1', campo: 'ensenanzaCurso', direccion: 'asc' },
      { id: 'o2', campo: 'apellidos',      direccion: 'asc' },
    ],
  },
  {
    id: 'alumnos-por-asignatura-matriculadas',
    nombre: 'Alumnos por asignatura (matriculadas)',
    descripcion: 'Una sección por asignatura con los alumnos matriculados en ella',
    predefinido: true,
    modo: 'asignatura',
    camposVisibles: ['apellidos', 'nombre', 'asigEstado', 'email', 'telefono'],
    filtros: [
      { id: 'f1', campo: 'asigEstado', operador: 'igual', valor: String(ESTADO_ASIGNATURA.MATRICULADA) },
    ],
    orden: [
      { id: 'o1', campo: 'apellidos', direccion: 'asc' },
    ],
    agruparPor: 'asigNombre',
  },
  {
    id: 'alumnos-por-asignatura-todas',
    nombre: 'Alumnos por asignatura (todos los estados)',
    descripcion: 'Una sección por asignatura con todos los alumnos, sea cual sea el estado',
    predefinido: true,
    modo: 'asignatura',
    camposVisibles: ['apellidos', 'nombre', 'asigEstado', 'email', 'telefono'],
    filtros: [],
    orden: [
      { id: 'o1', campo: 'apellidos', direccion: 'asc' },
    ],
    agruparPor: 'asigNombre',
  },
  {
    id: 'asignaturas-por-alumno',
    nombre: 'Asignaturas por alumno',
    descripcion: 'Una sección por alumno con las asignaturas en las que está matriculado',
    predefinido: true,
    modo: 'asignatura',
    camposVisibles: ['asigNombre', 'asigEstado', 'asigCodigo', 'especialidad'],
    filtros: [],
    orden: [
      { id: 'o1', campo: 'asigNombre', direccion: 'asc' },
    ],
    agruparPor: 'apellidos',
  },
];
