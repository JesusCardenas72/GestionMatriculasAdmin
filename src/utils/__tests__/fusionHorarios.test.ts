import { fusionarHorarios, type FilaCrudaHorario } from "../fusionHorarios";
import { crearTemporales } from "../temporales";
import type { FilaInforme, MatriculaLocal } from "../../api/types";
import { ESTADO } from "../../api/types";

function fila(nombreCompleto: string, ensenanzaCurso: string, especialidad: string, asigNombre: string): FilaInforme {
  return {
    rowId: crypto.randomUUID(),
    nOrden: null,
    nombreMatricula: "",
    nombre: "",
    apellidos: "",
    nombreCompleto,
    dni: "",
    email: "",
    telefono: null,
    fechaNacimiento: null,
    domicilio: null,
    localidad: null,
    provincia: null,
    cp: null,
    fechaInscripcion: "",
    createdon: "",
    cursoEscolar: "25/26",
    ensenanzaCurso,
    especialidad,
    formaPago: null,
    reduccionTasas: null,
    autorizacionImagen: false,
    disponibilidadManana: false,
    horaSalida: null,
    estado: ESTADO.TRAMITADO,
    docFaltante: null,
    repetidor: false,
    asigNombre,
  };
}

function cruda(nombreCompleto: string, curso: string, esp: string, asig: string, h: FilaCrudaHorario["h"]): FilaCrudaHorario {
  return { nombreCompleto, ensenanzaCurso: curso, especialidad: esp, asignatura: asig, h };
}

describe("fusionarHorarios", () => {
  // Un temporal de Piano EP1 sustituido por "Pérez, Ana"
  const [temporal] = crearTemporales("25/26", "EP1", "Piano", 1, []);
  const real: MatriculaLocal = {
    ...temporal,
    localId: "real-1",
    origenRowId: "real-1",
    esTemporal: undefined,
    temporalNumero: undefined,
    temporalEstado: undefined,
    sustituidoPorLocalId: undefined,
    nombre: "Ana",
    apellidos: "Pérez",
  };
  const temporalSustituido: MatriculaLocal = {
    ...temporal,
    temporalEstado: "sustituido",
    sustituidoPorLocalId: "real-1",
  };

  it("conserva horarios con coincidencia directa", () => {
    const filas = [fila("López, Juan", "EE2", "Canto", "Lenguaje Musical")];
    const crudas = [cruda("López, Juan", "EE2", "Canto", "Lenguaje Musical", { h_prof: "Profe X", h_dia1: "Lunes" })];
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(1);
    expect(r.heredadas).toBe(0);
    expect(r.valoresHorario[0]).toEqual({ h_prof: "Profe X", h_dia1: "Lunes" });
    expect(r.huerfanas).toHaveLength(0);
  });

  it("el alumno real hereda el horario de su temporal sustituido", () => {
    const filas = [fila("Pérez, Ana", "EP1", "Piano", "Instrumento")];
    const crudas = [
      cruda(temporal.nombre, "EP1", "Piano", "Instrumento", {
        h_prof: "Profe Y", h_aula: "A01", h_dia1: "Martes", h_ent1: "16:00", h_sal1: "17:00",
      }),
    ];
    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.heredadas).toBe(1);
    expect(r.valoresHorario[0]?.h_prof).toBe("Profe Y");
    expect(r.valoresHorario[0]?.h_aula).toBe("A01");
    expect(r.huerfanas).toHaveLength(0);
  });

  it("avisa de asignaturas del alumno nuevo sin horario heredado", () => {
    const filas = [fila("Pérez, Ana", "EP1", "Piano", "Coro")];
    const crudas = [
      cruda(temporal.nombre, "EP1", "Piano", "Instrumento", { h_prof: "Profe Y", h_dia1: "Lunes" }),
    ];
    const r = fusionarHorarios(filas, crudas, [temporalSustituido, real]);
    expect(r.valoresHorario[0]).toBeNull();
    expect(r.sinHorario).toHaveLength(1);
    expect(r.sinHorario[0]).toContain("Coro");
    // El horario del temporal queda huérfano (su asignatura no coincide)
    expect(r.huerfanas).toHaveLength(1);
  });

  it("lista como huérfanas las filas con horario que no encajan con ningún alumno", () => {
    const filas = [fila("López, Juan", "EE2", "Canto", "Lenguaje Musical")];
    const crudas = [
      cruda("Desconocido, X", "EE1", "Tuba", "Instrumento", { h_prof: "Profe Z", h_dia1: "Viernes" }),
      cruda("Sin Horario, Y", "EE1", "Tuba", "Instrumento", {}), // sin h_* → no cuenta
    ];
    const r = fusionarHorarios(filas, crudas, []);
    expect(r.conservadas).toBe(0);
    expect(r.huerfanas).toHaveLength(1);
    expect(r.huerfanas[0]).toContain("Desconocido");
  });
});
