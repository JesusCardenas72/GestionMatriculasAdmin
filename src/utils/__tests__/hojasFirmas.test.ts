import { describe, expect, it } from "vitest";
import {
  POR_HOJA,
  diasConClase,
  diasDeTexto,
  fechaDelDia,
  firmantesAsistencia,
  htmlHojasFirmas,
  lunesDeLaSemana,
  type Firmante,
} from "../hojasFirmas";
import type { HorarioComplementario } from "../../../electron/profesorado-complementario";
import type { Profesor } from "../../../electron/profesorado-store";
import type { HorariosEntry } from "../../../electron/horarios-data-store";

function prof(apellidosNombre: string, extra: Partial<Profesor> = {}): Profesor {
  return {
    id: apellidosNombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    apellidosNombre,
    especialidad: "",
    unidad: "",
    telefono: "",
    email: "",
    departamento: "",
    cargo: "",
    activo: true,
    sustitucion: null,
    ...extra,
  };
}

function clase(profesor: string, dia1: string, dia2 = ""): HorariosEntry {
  return {
    key: `${profesor}-${dia1}-${dia2}`,
    nombreCompleto: "Alumno",
    ensenanzaCurso: "EP 1",
    especialidad: "Piano",
    asignatura: "Piano",
    h: { h_prof: profesor, h_dia1: dia1, h_dia2: dia2 },
    createdAt: "",
    updatedAt: "",
  };
}

function compl(dias: string[]): HorarioComplementario {
  return {
    tramos: { TIAL: { dia: dias[0] ?? "", horario: "16:00" } },
    apoyo: dias.slice(1).map((dia) => ({ actividad: "Apoyo", aula: "", dia, horario: "" })),
    archivo: null,
    archivoModificado: null,
    importado: "",
  };
}

describe("diasDeTexto", () => {
  it("entiende nombres enteros, abreviaturas y letras", () => {
    expect(diasDeTexto("LUNES")).toEqual([0]);
    expect(diasDeTexto("miércoles")).toEqual([2]);
    expect(diasDeTexto("MIERCOLES")).toEqual([2]);
    expect(diasDeTexto("Miércole")).toEqual([2]);
    expect(diasDeTexto("mi.")).toEqual([2]);
    expect(diasDeTexto("jue.")).toEqual([3]);
    expect(diasDeTexto("vi.")).toEqual([4]);
    expect(diasDeTexto("X")).toEqual([2]);
    expect(diasDeTexto("M")).toEqual([1]);
  });

  it("reconoce varios días juntos", () => {
    expect(diasDeTexto("L y X")).toEqual([0, 2]);
    expect(diasDeTexto("M-X")).toEqual([1, 2]);
    expect(diasDeTexto("Jueves y Viernes")).toEqual([3, 4]);
    expect(diasDeTexto("Lunes (2h)")).toEqual([0]);
  });

  it("no inventa días donde no los hay", () => {
    expect(diasDeTexto("compensada")).toEqual([]);
    expect(diasDeTexto("2h Lectivas coord E+")).toEqual([]);
    expect(diasDeTexto("")).toEqual([]);
    expect(diasDeTexto(undefined)).toEqual([]);
  });
});

describe("fechas de la semana", () => {
  it("lleva cualquier día a su lunes", () => {
    expect(lunesDeLaSemana("2026-09-23")).toBe("2026-09-21"); // miércoles
    expect(lunesDeLaSemana("2026-09-21")).toBe("2026-09-21"); // lunes
    expect(lunesDeLaSemana("2026-09-27")).toBe("2026-09-21"); // domingo
  });

  it("calcula cada día de la semana, también al cambiar de mes", () => {
    expect(fechaDelDia("2026-09-28", 4)).toBe("2026-10-02");
  });
});

describe("firmantesAsistencia", () => {
  const ana = prof("Pérez Gómez, Ana");
  const bea = prof("Álvarez Ruiz, Bea");
  const carlos = prof("Zamora Díaz, Carlos");
  const dani = prof("López Sanz, Dani", { activo: false });

  const entries = [clase(ana.apellidosNombre, "Lunes", "Miércoles"), clase(dani.apellidosNombre, "Lunes")];
  const porDia = diasConClase(entries);
  const complementario = { [carlos.id]: compl(["LUNES", "jue."]) };

  it("junta clases y horario complementario, en orden alfabético y sin bajas archivadas", () => {
    const lunes = firmantesAsistencia([carlos, ana, bea, dani], porDia, complementario, 0, "2026-09-21");
    expect(lunes.map((f) => f.nombre)).toEqual([ana.apellidosNombre, carlos.apellidosNombre]);
  });

  it("solo sale quien trabaja ese día", () => {
    const miercoles = firmantesAsistencia([carlos, ana, bea], porDia, complementario, 2, "2026-09-23");
    expect(miercoles.map((f) => f.nombre)).toEqual([ana.apellidosNombre]);
    const jueves = firmantesAsistencia([carlos, ana, bea], porDia, complementario, 3, "2026-09-24");
    expect(jueves.map((f) => f.nombre)).toEqual([carlos.apellidosNombre]);
  });

  it("con una baja temporal vigente firma el sustituto y no el titular", () => {
    const titular = prof("Pérez Gómez, Ana", {
      sustitucion: { sustitutoId: bea.id, desde: "2026-09-01", hasta: "2026-09-30" },
    } as Partial<Profesor>);
    const lunes = firmantesAsistencia([titular, bea], porDia, {}, 0, "2026-09-21");
    expect(lunes).toEqual<Firmante[]>([
      { id: bea.id, nombre: bea.apellidosNombre, nota: `Sustituye a ${titular.apellidosNombre}` },
    ]);
    // Terminada la baja vuelve a firmar el titular.
    const octubre = firmantesAsistencia([titular, bea], porDia, {}, 0, "2026-10-05");
    expect(octubre.map((f) => f.nombre)).toEqual([titular.apellidosNombre]);
  });
});

describe("htmlHojasFirmas", () => {
  const firmantes = (n: number): Firmante[] =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nombre: `Profesor ${i + 1}` }));

  it("reparte los firmantes en hojas y numera a cada uno", () => {
    const html = htmlHojasFirmas("Doc", [
      { titulo: "Claustro", lineas: ["Aprobación de la PGA", "", "Curso 26/27"], firmantes: firmantes(POR_HOJA + 3) },
    ]);
    expect(html.match(/class="hoja"/g)).toHaveLength(2);
    expect(html).toContain("Hoja 2 de 2");
    expect(html).toContain(`${POR_HOJA + 3}.</span> Profesor ${POR_HOJA + 3}`);
    expect(html.match(/class="recuadro"/g)).toHaveLength(POR_HOJA + 3);
    expect(html).toContain("width: 40mm; height: 20mm");
    expect(html).toContain("size: A4 landscape");
  });

  it("cada día empieza en su hoja y escapa el texto", () => {
    const html = htmlHojasFirmas("Doc", [
      { titulo: "Asistencia", lineas: ["Lunes"], firmantes: [{ id: "a", nombre: "O'Neil <Ana>" }] },
      { titulo: "Asistencia", lineas: ["Martes"], firmantes: [] },
    ]);
    expect(html.match(/class="hoja"/g)).toHaveLength(2);
    expect(html).toContain("O'Neil &lt;Ana&gt;");
    expect(html).toContain("No hay nadie que tenga que firmar");
  });
});
