import {
  buildCertificadoHorarioHtml,
  buscarHorarioDeMatricula,
  cursoYGrado,
  fechaCertificado,
  filasHorario,
  nombreNatural,
  SECRETARIO_POR_DEFECTO,
} from "../certificadoHorario";
import { normNombre } from "../horarioEnvio";
import type { ClaseHorario, HorarioAlumno } from "../../horarios/types";

const clase = (dia: string, entrada: string, salida: string, asignatura: string): ClaseHorario => ({
  asignatura, profesor: "", aula: "", grupo: "", dia, entrada, salida,
});

describe("certificadoHorario", () => {
  it("convierte curso y grado", () => {
    expect(cursoYGrado("EP3")).toBe("3º de Enseñanzas Profesionales");
    expect(cursoYGrado("EE2")).toBe("2º de Enseñanzas Elementales");
    expect(cursoYGrado("Otro")).toBe("Otro");
  });

  it("formatea la fecha en castellano", () => {
    expect(fechaCertificado(new Date(2026, 9, 22))).toBe("22 de octubre de 2026");
  });

  it("pone el nombre en orden natural", () => {
    expect(nombreNatural("García López, Ana")).toBe("Ana García López");
    expect(nombreNatural("Ana")).toBe("Ana");
  });

  it("ordena por día y hora y quita duplicados", () => {
    const filas = filasHorario([
      clase("Miércoles", "17:00", "18:00", "Piano"),
      clase("Lunes", "18:00", "19:00", "Coro"),
      clase("Lunes", "9:30", "10:30", "Lenguaje"),
      clase("Lunes", "18:00", "19:00", "Coro"),
    ]);
    expect(filas.map((f) => f.asignatura)).toEqual(["Lenguaje", "Coro", "Piano"]);
  });

  describe("buscarHorarioDeMatricula", () => {
    const horario = (nombre: string, ensenanzaCurso: string, especialidad: string, id?: string): HorarioAlumno => ({
      clave: nombre + especialidad, nombre, email: "", ensenanzaCurso, especialidad,
      clases: [{ ...clase("Lunes", "17:00", "18:00", "X"), idAlumnoAsignatura: id }],
    });
    const alumnos = [
      horario("García López, Ana", "EP3", "Piano"),
      horario("García López, Ana", "EP1", "Violín"),
      horario("Ruiz, Eva", "EE2", "Flauta", "42_123"),
    ];

    it("encuentra por nº de orden aunque el nombre no coincida", () => {
      const r = buscarHorarioDeMatricula(alumnos, { nOrden: 42, ensenanzaCurso: "EE2", especialidad: "Flauta", candidatosNombre: [] });
      expect(r?.nombre).toBe("Ruiz, Eva");
    });

    it("por nombre elige la matrícula de su especialidad", () => {
      const r = buscarHorarioDeMatricula(alumnos, {
        nOrden: null, ensenanzaCurso: "EP1", especialidad: "Violín", candidatosNombre: [normNombre("García López, Ana")],
      });
      expect(r?.especialidad).toBe("Violín");
    });

    it("devuelve null si no hay horario", () => {
      expect(buscarHorarioDeMatricula(alumnos, { nOrden: 7, ensenanzaCurso: "", especialidad: "", candidatosNombre: ["nadie"] })).toBeNull();
    });
  });

  it("rellena los datos del alumno en el certificado", () => {
    const html = buildCertificadoHorarioHtml({
      nombreCompleto: "Ana García López",
      dni: "12345678Z",
      especialidad: "Piano",
      ensenanzaCurso: "EP3",
      clases: [clase("Lunes", "17:00", "18:00", "Piano <solo>")],
      genero: "alumna",
      secretario: SECRETARIO_POR_DEFECTO,
      fecha: new Date(2026, 9, 22),
    });
    expect(html).toContain("“Ana García López”");
    expect(html).toContain("12345678Z");
    expect(html).toContain("es alumna de este centro");
    expect(html).toContain("“3º de Enseñanzas Profesionales”");
    expect(html).toContain("Piano &lt;solo&gt;");
    expect(html).toContain("Ciudad Real a 22 de octubre de 2026");
    expect(html).toContain("D. Santiago Aguilar Rodero");
  });
});
