import ExcelJS from "exceljs";
import { parseArchivoTemporales } from "../importTemporales";

function csvBuffer(texto: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(texto);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("parseArchivoTemporales (CSV)", () => {
  it("lee filas válidas con separador ; y normaliza curso y especialidad", async () => {
    const csv = "Apellidos;Nombre;Grado/Curso;Especialidad\nGarcía López;Ana;ep4;piano\nRuiz;Luis;EE2;Violín\n";
    const { filas, errores } = await parseArchivoTemporales("alumnos.csv", csvBuffer(csv));
    expect(errores).toHaveLength(0);
    expect(filas).toEqual([
      { apellidos: "García López", nombre: "Ana", ensenanzaCurso: "EP4", especialidad: "Piano" },
      { apellidos: "Ruiz", nombre: "Luis", ensenanzaCurso: "EE2", especialidad: "Violín" },
    ]);
  });

  it("acepta separador coma, BOM y campos entrecomillados", async () => {
    const csv = '﻿Apellidos,Nombre,Curso,Especialidad\n"García, de la Vega",Ana,EP1,Piano\n';
    const { filas, errores } = await parseArchivoTemporales("alumnos.csv", csvBuffer(csv));
    expect(errores).toHaveLength(0);
    expect(filas[0].apellidos).toBe("García, de la Vega");
  });

  it("reporta filas con curso o especialidad no válidos y filas incompletas", async () => {
    const csv =
      "Apellidos;Nombre;Grado/Curso;Especialidad\n" +
      "García;Ana;EP9;Piano\n" + // curso inválido
      "Ruiz;Luis;EP1;Theremin\n" + // especialidad inexistente
      ";SinApellidos;EP1;Piano\n" + // faltan apellidos
      "Vega;Eva;EP2;Piano\n";
    const { filas, errores } = await parseArchivoTemporales("alumnos.csv", csvBuffer(csv));
    expect(filas).toHaveLength(1);
    expect(filas[0].apellidos).toBe("Vega");
    expect(errores).toHaveLength(3);
    expect(errores[0]).toContain("EP9");
    expect(errores[1]).toContain("Theremin");
  });

  it("falla con un mensaje claro si faltan columnas", async () => {
    const csv = "Apellidos;Nombre\nGarcía;Ana\n";
    await expect(parseArchivoTemporales("alumnos.csv", csvBuffer(csv))).rejects.toThrow(/Grado\/Curso/);
  });
});

describe("parseArchivoTemporales (Excel)", () => {
  it("lee la primera hoja de un xlsx con las cabeceras esperadas", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Alumnos");
    ws.addRow(["Apellidos", "Nombre", "Grado/Curso", "Especialidad"]);
    ws.addRow(["García", "Ana", "EP4", "Piano"]);
    ws.addRow(["Ruiz", "Luis", "EE2", "Violín"]);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const { filas, errores } = await parseArchivoTemporales("alumnos.xlsx", buf);
    expect(errores).toHaveLength(0);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toEqual({ apellidos: "García", nombre: "Ana", ensenanzaCurso: "EP4", especialidad: "Piano" });
  });
});
