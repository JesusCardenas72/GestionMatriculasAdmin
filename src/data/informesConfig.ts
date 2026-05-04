import { ESTADO } from '../api/types';
import type { CampoKey, ConfigInforme, OperadorFiltro } from '../api/types';

export interface CampoMeta {
  key: CampoKey;
  label: string;
  tipo: 'texto' | 'booleano' | 'fecha' | 'numero' | 'estado';
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
];

export const CAMPO_MAP = new Map<CampoKey, CampoMeta>(
  CAMPOS_META.map(c => [c.key, c]),
);

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

// ── Configuraciones de informe ────────────────────────────────────────────────

export const INFORME_VACIO: ConfigInforme = {
  id: 'personalizado',
  nombre: 'Informe personalizado',
  camposVisibles: ['apellidos', 'nombre', 'ensenanzaCurso', 'email'],
  filtros: [],
  orden: [],
};

export const INFORMES_PREDEFINIDOS: ConfigInforme[] = [
  {
    id: 'listado-especialidad',
    nombre: 'Listado por especialidad',
    descripcion: 'Alumnos de una especialidad, ordenados por enseñanza, curso y apellidos',
    predefinido: true,
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
];
