import {
  textoReenvio,
  buildAmpliacionAutorizadaEmailHtml,
  pasosMatricula,
  textoTasas,
  URL_MODELO_046,
} from "./emailAmpliacionAutorizada";
import { URL_MATRICULA_DIGITAL } from "./ampliacionEnEspera";

const base = {
  nombre: "Ana",
  apellidos: "Pérez <García>",
  cursoActual: "EE3",
  cursoDestino: "EE4",
  especialidad: "Piano",
};

describe("correo de ampliación autorizada", () => {
  it("dice que está autorizada, el curso nuevo y lleva el enlace a la matrícula digital", () => {
    const html = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" } });
    expect(html).toContain("aceptada y autorizada por la Jefatura de Estudios y el Equipo Docente");
    expect(html).toContain("con la mayor brevedad posible");
    expect(html).toContain("4º de Enseñanzas Elementales (EE4)");
    expect(html).toContain(`href="${URL_MATRICULA_DIGITAL}"`);
    // El nombre va escapado
    expect(html).toContain("Pérez &lt;García&gt;");
  });

  it("si debe pagar, incluye el Modelo 046 y pide el justificante", () => {
    const html = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" } });
    expect(html).toContain(URL_MODELO_046);
    expect(html).toContain("2032");
    expect(html).toContain("con el justificante de pago de la tasa");
  });

  it("si está exento o tiene beca, no habla del Modelo 046", () => {
    for (const situacion of [{ tipo: "beca" as const }, { tipo: "exento" as const, motivo: "Discapacidad" }]) {
      const html = buildAmpliacionAutorizadaEmailHtml({ ...base, cursoDestino: "EP2", situacion });
      expect(html).not.toContain(URL_MODELO_046);
      expect(html).not.toContain("justificante de pago de la tasa");
    }
  });

  it("las observaciones solo aparecen si se escriben", () => {
    const sin = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" } });
    const con = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" }, observaciones: "Traiga el DNI" });
    expect(sin).not.toContain("Observaciones");
    expect(con).toContain("Traiga el DNI");
  });
});

describe("textoTasas", () => {
  it("una frase por cada situación", () => {
    expect(textoTasas({ tipo: "beca" })).toMatch(/no tiene que pagar/);
    expect(textoTasas({ tipo: "exento", motivo: "Discapacidad" })).toMatch(/exención de tasas por Discapacidad/);
    expect(textoTasas({ tipo: "reducida", motivo: "Familia Numerosa General" })).toMatch(/50 %/);
    expect(textoTasas({ tipo: "paga" })).toMatch(/Debe pagar/);
  });
});

describe("pasosMatricula", () => {
  it("indica qué elegir en el formulario y que no marque primer año", () => {
    const pasos = pasosMatricula({ cursoDestino: "EP2", especialidad: "Violín", situacion: { tipo: "beca" } }).join("\n");
    expect(pasos).toContain("Enseñanza <strong>Profesional</strong>, Curso <strong>2º</strong>");
    expect(pasos).toContain("Especialidad <strong>Violín</strong>");
    expect(pasos).toContain("No marque «Primer año en el centro»");
    expect(pasos).toContain("Solicita Beca");
    expect(pasos).toContain("justificante de registro de la beca");
    expect(pasos).not.toContain("Modelo 046");
  });

  it("con reducción pide elegirla y acreditarla, y pagar con el 046", () => {
    const pasos = pasosMatricula({
      cursoDestino: "EE4",
      especialidad: "Piano",
      situacion: { tipo: "reducida", motivo: "Familia Numerosa General" },
    }).join("\n");
    expect(pasos).toContain("<strong>Familia Numerosa General</strong>");
    expect(pasos).toContain("Modelo 046");
    expect(pasos).toContain("acredita la reducción");
  });
});

describe("con enlace personal (datos cifrados)", () => {
  it("el botón lleva el enlace personal y no muestra la dirección", () => {
    const url = "https://matriculacion-digital.vercel.app/#ampliacion=1d.AAA.BBB.CCC";
    const html = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" }, urlFormulario: url, llave: "d" });
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain("el enlace es personal");
  });

  it("los pasos dicen que escriba el DNI y que los datos vienen rellenos", () => {
    const pasos = pasosMatricula({ cursoDestino: "EE4", especialidad: "Piano", situacion: { tipo: "paga" }, llave: "d" }).join("\n");
    expect(pasos).toContain("<strong>DNI/NIE</strong>");
    expect(pasos).toContain("ya rellenos");
    expect(pasos).toContain("Ya vienen elegidos Enseñanza <strong>Elemental</strong>, Curso <strong>4º</strong>");
    expect(pasos).toContain("tutores legales");
    expect(pasos).toContain("Modelo 046");
    expect(pasos).not.toContain("No marque «Primer año");
  });

  it("si el alumno no tiene DNI, pide la clave de acceso y el correo la muestra", () => {
    const pasos = pasosMatricula({ cursoDestino: "EP2", especialidad: "Violín", situacion: { tipo: "beca" }, llave: "c", clave: "ABCD-EFGH" }).join("\n");
    expect(pasos).toContain("<strong>clave de acceso ABCD-EFGH</strong>");
    expect(pasos).not.toContain("DNI/NIE");
    const html = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" }, urlFormulario: "https://x/#ampliacion=1c.a.b.c", llave: "c", clave: "ABCD-EFGH" });
    expect(html).toContain("Clave de acceso");
    expect(html).toContain(">ABCD-EFGH<");
  });

  it("con DNI no aparece ninguna clave", () => {
    const html = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" }, urlFormulario: "https://x/#ampliacion=1d.a.b.c", llave: "d" });
    expect(html).not.toContain("Clave de acceso");
  });
});

describe("reenvío", () => {
  it("avisa del correo anterior y de matricularse una sola vez", () => {
    const html = buildAmpliacionAutorizadaEmailHtml({
      ...base,
      situacion: { tipo: "paga" },
      urlFormulario: "https://x/#ampliacion=1c.a.b.c",
      llave: "c",
      clave: "WXYZ-2345",
      reenvioDe: "2026-11-26T10:00:00Z",
    });
    expect(html).toContain("Reenvío");
    expect(html).toContain("26/11/2026");
    expect(html).toContain("UNA SOLA VEZ");
    expect(html).toContain(">WXYZ-2345<");
  });

  it("el primer envío no lleva el aviso", () => {
    const html = buildAmpliacionAutorizadaEmailHtml({ ...base, situacion: { tipo: "paga" }, llave: "c", clave: "WXYZ-2345" });
    expect(html).not.toContain("UNA SOLA VEZ");
  });

  it("textoReenvio", () => {
    expect(textoReenvio("2026-11-26T10:00:00Z")).toMatch(/Ya le enviamos otro el 26\/11\/2026/);
  });
});
