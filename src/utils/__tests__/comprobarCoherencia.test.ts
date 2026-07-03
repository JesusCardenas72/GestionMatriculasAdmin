import { describe, it, expect } from "vitest";
import { comprobarCoherenciaLocalHorario } from "../comprobarCoherencia";
import { crearTemporales } from "../temporales";
import type { MatriculaLocal, AsignaturaLocal } from "../../api/types";
import { ESTADO_ASIGNATURA } from "../../api/types";
import type { HorariosEntry } from "../../../electron/horarios-data-store";

function base(): MatriculaLocal {
  const [m] = crearTemporales("26/27", "EP1", "Trompeta", 1, []);
  return m;
}

function real(over: Partial<MatriculaLocal>): MatriculaLocal {
  return {
    ...base(),
    localId: crypto.randomUUID(),
    origenRowId: "o",
    esTemporal: false,
    temporalNumero: undefined,
    temporalEstado: undefined,
    sustituidoPorLocalId: null,
    sustituyeATemporalId: null,
    asignaturas: [],
    ...over,
  };
}

function ghost(over: Partial<MatriculaLocal>): MatriculaLocal {
  return { ...base(), localId: crypto.randomUUID(), temporalEstado: "pendiente", asignaturas: [], ...over };
}

function asig(nombre: string, estado: AsignaturaLocal["estado"] = ESTADO_ASIGNATURA.MATRICULADA): AsignaturaLocal {
  return { localId: crypto.randomUUID(), rowId: null, asignaturaId: null, codigo: 1, nombre, estado, observaciones: null, horario: null };
}

function ent(nombre: string, curso: string, especialidad: string, asignatura: string): HorariosEntry {
  return {
    key: `${nombre}|${curso}|${especialidad}|${asignatura}`,
    nombreCompleto: nombre,
    ensenanzaCurso: curso,
    especialidad,
    asignatura,
    h: { h_prof: "Profe X" },
    createdAt: "",
    updatedAt: "",
  };
}

describe("comprobarCoherenciaLocalHorario", () => {
  it("1) detecta espacios sobrantes en el nombre de Local", () => {
    const r = comprobarCoherenciaLocalHorario(
      [real({ apellidos: "Bastante Moreno ", nombre: "Jaime ", ensenanzaCurso: "EE3", especialidad: "Oboe" })],
      [],
    );
    expect(r.espaciosEnNombre).toHaveLength(1);
    expect(r.espaciosEnNombre[0].nombreLimpio).toBe("Bastante Moreno, Jaime");
  });

  it("2) detecta fantasma con horario cuyo real ya está matriculado sin vincular (y propone el nombre con tilde)", () => {
    const f = ghost({ apellidos: "Alegre Muñoz_Temp", nombre: "Aarón_Temp", especialidad: "Trompeta" });
    const r = real({ apellidos: "Alegre Muñoz", nombre: "Aaron", especialidad: "Trompeta" });
    const res = comprobarCoherenciaLocalHorario(
      [f, r],
      [ent("Alegre Muñoz_Temp, Aarón_Temp", "EP1", "Trompeta", "Instrumento")],
    );
    expect(res.fantasmasSinVincular).toHaveLength(1);
    const fsv = res.fantasmasSinVincular[0];
    expect(fsv.realLocalId).toBe(r.localId);
    expect(fsv.fantasmaLocalId).toBe(f.localId);
    expect(fsv.nombrePropuesto).toBe("Alegre Muñoz, Aarón");
    expect(fsv.nAsignaturasHorario).toBe(1);
  });

  it("2b) NO marca el fantasma si el real ya está vinculado a él", () => {
    const f = ghost({ apellidos: "Alegre Muñoz_Temp", nombre: "Aarón_Temp", especialidad: "Trompeta" });
    const r = real({ apellidos: "Alegre Muñoz", nombre: "Aaron", especialidad: "Trompeta", sustituyeATemporalId: f.localId });
    const res = comprobarCoherenciaLocalHorario([f, r], [ent("Alegre Muñoz_Temp, Aarón_Temp", "EP1", "Trompeta", "Instrumento")]);
    expect(res.fantasmasSinVincular).toHaveLength(0);
  });

  it("3) marca una fila del horario sin Local y sugiere la errata de apellido", () => {
    const r = real({ apellidos: "Liu", nombre: "Lian Alejandro", ensenanzaCurso: "EP5", especialidad: "Violín" });
    const res = comprobarCoherenciaLocalHorario([r], [ent("Liv, Lian Alejandro", "EP5", "Violín", "Instrumento")]);
    expect(res.alumnosEnHorarioSinLocal).toHaveLength(1);
    expect(res.alumnosEnHorarioSinLocal[0].posibleTypoDe).toBe("Liu, Lian Alejandro");
  });

  it("4) detecta el mismo alumno escrito de dos formas en el horario", () => {
    const r = real({ apellidos: "Gude Díaz - Ropero", nombre: "María", ensenanzaCurso: "EP1", especialidad: "Guitarra", asignaturas: [asig("Instrumento")] });
    const res = comprobarCoherenciaLocalHorario(
      [r],
      [
        ent("Gude Díaz - Ropero, María", "EP1", "Guitarra", "Instrumento"),
        ent("Gude Díaz-ropero, María", "EP1", "Guitarra", "Conjunto"),
      ],
    );
    expect(res.nombresDuplicadosEnHorario).toHaveLength(1);
    expect(res.nombresDuplicadosEnHorario[0].variantes).toHaveLength(2);
  });

  it("5) detecta asignatura presente en el horario pero no en Local", () => {
    const r = real({ apellidos: "Jiménez", nombre: "Claudia", ensenanzaCurso: "EP6", especialidad: "Contrabajo", asignaturas: [asig("Instrumento")] });
    const res = comprobarCoherenciaLocalHorario(
      [r],
      [ent("Jiménez, Claudia", "EP6", "Contrabajo", "Instrumento"), ent("Jiménez, Claudia", "EP6", "Contrabajo", "Improvisación")],
    );
    expect(res.asignaturasSoloEnHorario.map((a) => a.asignatura)).toContain("Improvisación");
  });

  it("clasifica los «PDTE.» con horario como fantasmas pendientes, no como incoherencia", () => {
    const res = comprobarCoherenciaLocalHorario([], [ent("PDTE. 100 — Piano EE1", "EE1", "Piano", "Instrumento")]);
    expect(res.fantasmasPendientes).toHaveLength(1);
    expect(res.alumnosEnHorarioSinLocal).toHaveLength(0);
    expect(res.totalIncoherencias).toBe(0);
  });
});
