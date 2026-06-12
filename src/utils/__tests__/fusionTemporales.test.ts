import ExcelJS from "exceljs";
import {
  camposDesdeExcelHorarios,
  filasAsignaturaLocales,
  ordenarComoExcel,
} from "../fusionTemporales";
import type { FilaCrudaHorario } from "../fusionHorarios";
import { crearTemporales, crearTemporalesNominales } from "../temporales";
import type { MatriculaLocal } from "../../api/types";
import { ESTADO_ASIGNATURA } from "../../api/types";

async function excelConCabeceras(cabeceras: string[]): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Horarios");
  ws.addRow(cabeceras);
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

describe("camposDesdeExcelHorarios", () => {
  it("reconstruye los campos en orden y localiza dónde van las columnas de horario", async () => {
    const base64 = await excelConCabeceras([
      "Apellidos", "Nombre", "Enseñanza / Curso", "Especialidad", "Asignatura",
      "Profesor", "Grupo", "Aula", "Día 1", "Entrada 1", "Salida 1", "Día 2", "Entrada 2", "Salida 2",
      "Email", "Teléfono",
    ]);
    const r = await camposDesdeExcelHorarios(base64);
    expect(r.campos.map((c) => c.key)).toEqual([
      "apellidos", "nombre", "ensenanzaCurso", "especialidad", "asigNombre", "email", "telefono",
    ]);
    expect(r.insertarTras).toBe("asigNombre");
    expect(r.desconocidas).toHaveLength(0);
  });

  it("reporta cabeceras desconocidas y falla si no reconoce ninguna columna", async () => {
    const conRaras = await excelConCabeceras(["Apellidos", "Columna Inventada", "Profesor"]);
    const r = await camposDesdeExcelHorarios(conRaras);
    expect(r.campos.map((c) => c.key)).toEqual(["apellidos"]);
    expect(r.desconocidas).toEqual(["Columna Inventada"]);

    const sinCampos = await excelConCabeceras(["Profesor", "Aula"]);
    await expect(camposDesdeExcelHorarios(sinCampos)).rejects.toThrow(/No se reconoce/);
  });
});

describe("filasAsignaturaLocales", () => {
  it("expande por asignatura, excluye sustituidos e incluye temporales pendientes", () => {
    const [pendiente] = crearTemporales("25/26", "EP1", "Piano", 1, []);
    const [sustituido] = crearTemporales("25/26", "EP1", "Piano", 1, [pendiente]);
    sustituido.temporalEstado = "sustituido";
    const real: MatriculaLocal = {
      ...pendiente,
      localId: "real-1",
      origenRowId: "real-1",
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      nombre: "Ana",
      apellidos: "Pérez",
      asignaturas: [
        {
          localId: "a1", rowId: null, asignaturaId: null, codigo: 1,
          nombre: "Instrumento", estado: ESTADO_ASIGNATURA.MATRICULADA,
          observaciones: null, horario: null,
        },
        {
          localId: "a2", rowId: null, asignaturaId: null, codigo: 2,
          nombre: "Lenguaje Musical", estado: ESTADO_ASIGNATURA.MATRICULADA,
          observaciones: null, horario: null,
        },
      ],
    };
    const filas = filasAsignaturaLocales([pendiente, sustituido, real]);
    const deReal = filas.filter((f) => f.apellidos === "Pérez");
    expect(deReal).toHaveLength(2);
    expect(deReal[0].esTemporal).toBeFalsy();
    // El temporal pendiente aparece con todas sus asignaturas y marcado como temporal
    const deTemporal = filas.filter((f) => f.esTemporal);
    expect(deTemporal.length).toBe(pendiente.asignaturas.length);
    // El sustituido no aparece
    expect(filas.some((f) => String(f.rowId).startsWith(sustituido.localId))).toBe(false);
  });
});

describe("ordenarComoExcel", () => {
  it("mantiene el orden del Excel y el sustituto hereda la posición de su temporal", () => {
    // Temporal nominal sustituido por "García, Ana"
    const { creados } = crearTemporalesNominales(
      "25/26",
      [{ apellidos: "García", nombre: "Ana", ensenanzaCurso: "EP1", especialidad: "Piano" }],
      [],
    );
    const temporal: MatriculaLocal = { ...creados[0], temporalEstado: "sustituido", sustituidoPorLocalId: "real-1" };
    const real: MatriculaLocal = {
      ...creados[0],
      localId: "real-1",
      origenRowId: "real-1",
      esTemporal: undefined,
      temporalNumero: undefined,
      temporalEstado: undefined,
      sustituidoPorLocalId: undefined,
      nombre: "Ana",
      apellidos: "García",
    };
    // En el Excel original: primero Zurita (real), luego el temporal
    const crudas: FilaCrudaHorario[] = [
      { nombreCompleto: "Zurita, Pablo", ensenanzaCurso: "EP1", especialidad: "Piano", asignatura: "Instrumento", h: { h_prof: "X" } },
      { nombreCompleto: "García_Temp, Ana_Temp", ensenanzaCurso: "EP1", especialidad: "Piano", asignatura: "Instrumento", h: { h_prof: "Y" } },
    ];
    const filas = [
      // Desordenadas a propósito: la real de García (sustituta), un alumno nuevo y Zurita
      { nombreCompleto: "García, Ana", apellidos: "García", nombre: "Ana", ensenanzaCurso: "EP1", especialidad: "Piano", asigNombre: "Instrumento" },
      { nombreCompleto: "Nuevo, Alumno", apellidos: "Nuevo", nombre: "Alumno", ensenanzaCurso: "EP1", especialidad: "Piano", asigNombre: "Instrumento" },
      { nombreCompleto: "Zurita, Pablo", apellidos: "Zurita", nombre: "Pablo", ensenanzaCurso: "EP1", especialidad: "Piano", asigNombre: "Instrumento" },
    ] as never[];
    const ordenadas = ordenarComoExcel(filas, crudas, [temporal, real]);
    expect(ordenadas.map((f) => f.nombreCompleto)).toEqual([
      "Zurita, Pablo", // primera fila del Excel
      "García, Ana", // hereda la posición de su temporal (segunda fila)
      "Nuevo, Alumno", // no estaba en el Excel → al final
    ]);
  });
});
