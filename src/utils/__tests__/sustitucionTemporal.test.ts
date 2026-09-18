import { describe, expect, it } from "vitest";
import {
  avisosSustitucionTemporal,
  diaAnterior,
  esSustitutoTemporal,
  estaSustituido,
  fechaCorta,
  historialCompleto,
  indiceSustituciones,
  iniciarSustitucionTemporal,
  renombrarEnSustituciones,
  sanearHistorial,
  sanearSustitucion,
  sustitucionAbierta,
  sustitucionPendienteDeCierre,
  sustitucionVigente,
  sustituyeA,
  terminarSustitucionTemporal,
  validarSustitucionTemporal,
} from "../../../electron/profesorado-sustitucion";
import type { Profesor } from "../../../electron/profesorado-store";

const HOY = "2026-11-10";

function prof(nombre: string, extra: Partial<Profesor> = {}): Profesor {
  return {
    id: nombre.toLowerCase(),
    apellidosNombre: nombre,
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

describe("fechas", () => {
  it("el día anterior cruza bien el cambio de mes", () => {
    expect(diaAnterior("2026-11-01")).toBe("2026-10-31");
    expect(diaAnterior("2027-01-01")).toBe("2026-12-31");
  });

  it("formatea en español y deja intacto lo que no es fecha", () => {
    expect(fechaCorta("2026-09-18")).toBe("18/09/2026");
    expect(fechaCorta("")).toBe("");
    expect(fechaCorta("mañana")).toBe("mañana");
  });
});

describe("vigencia", () => {
  it("una sustitución sin fecha de fin sigue vigente", () => {
    const p = prof("Titular", { sustitucion: { sustitutoId: "s", desde: "2026-10-01", hasta: null } });
    expect(sustitucionVigente(p, HOY)).not.toBeNull();
  });

  it("una sustitución con fecha de fin pasada deja de estar vigente sola", () => {
    const p = prof("Titular", {
      sustitucion: { sustitutoId: "s", desde: "2026-10-01", hasta: "2026-10-31" },
    });
    expect(sustitucionVigente(p, HOY)).toBeNull();
    expect(sustitucionPendienteDeCierre(p, HOY)).not.toBeNull();
  });

  it("una sustitución que aún no ha empezado no está vigente, pero sí está anotada", () => {
    const p = prof("Titular", { sustitucion: { sustitutoId: "s", desde: "2026-12-01", hasta: null } });
    expect(sustitucionVigente(p, HOY)).toBeNull();
    expect(sustitucionAbierta(p, HOY)).not.toBeNull();
  });

  it("una sustitución terminada no está ni vigente ni abierta", () => {
    const p = prof("Titular", {
      sustitucion: { sustitutoId: "s", desde: "2026-09-01", hasta: "2026-09-30" },
    });
    expect(sustitucionVigente(p, HOY)).toBeNull();
    expect(sustitucionAbierta(p, HOY)).toBeNull();
  });
});

describe("índice titular ↔ sustituto", () => {
  const titular = prof("Pérez, Ana", {
    sustitucion: { sustitutoId: "gómez, luis", desde: "2026-10-01", hasta: null },
  });
  const sustituto = prof("Gómez, Luis");
  const ajeno = prof("Ruiz, Eva");
  const lista = [titular, sustituto, ajeno];

  it("sabe quién está de baja y quién sustituye", () => {
    const indice = indiceSustituciones(lista, HOY);
    expect(estaSustituido(indice, titular.id)).toBe(true);
    expect(esSustitutoTemporal(indice, sustituto.id)).toBe(true);
    expect(esSustitutoTemporal(indice, ajeno.id)).toBe(false);
    expect(sustituyeA(indice, sustituto.id).map((v) => v.titular.id)).toEqual([titular.id]);
  });

  it("ignora la sustitución si el sustituto ya no tiene ficha", () => {
    const indice = indiceSustituciones([titular, ajeno], HOY);
    expect(estaSustituido(indice, titular.id)).toBe(false);
  });

  it("una misma persona puede sustituir a dos titulares", () => {
    const otro = prof("Soler, Mar", {
      sustitucion: { sustitutoId: "gómez, luis", desde: "2026-10-05", hasta: null },
    });
    const indice = indiceSustituciones([...lista, otro], HOY);
    expect(sustituyeA(indice, sustituto.id)).toHaveLength(2);
  });
});

describe("iniciar, cambiar y terminar", () => {
  const base = [prof("Pérez, Ana"), prof("Gómez, Luis"), prof("Ruiz, Eva")];

  it("nombra un sustituto sin tocar al resto de fichas", () => {
    const lista = iniciarSustitucionTemporal(base, {
      titularId: "pérez, ana",
      sustitutoId: "gómez, luis",
      desde: "2026-10-01",
      hasta: null,
      motivo: "Baja laboral",
    });
    const titular = lista.find((p) => p.id === "pérez, ana")!;
    expect(titular.sustitucion).toEqual({
      sustitutoId: "gómez, luis",
      desde: "2026-10-01",
      hasta: null,
      motivo: "Baja laboral",
    });
    // El titular sigue en activo: una baja temporal no archiva su ficha.
    expect(titular.activo).toBe(true);
    expect(lista.find((p) => p.id === "ruiz, eva")).toBe(base[2]);
  });

  it("al cambiar de sustituto cierra la anterior la víspera y la guarda en el historial", () => {
    const conPrimera = iniciarSustitucionTemporal(base, {
      titularId: "pérez, ana",
      sustitutoId: "gómez, luis",
      desde: "2026-10-01",
      hasta: null,
    });
    const conSegunda = iniciarSustitucionTemporal(conPrimera, {
      titularId: "pérez, ana",
      sustitutoId: "ruiz, eva",
      desde: "2026-11-02",
      hasta: null,
    });
    const titular = conSegunda.find((p) => p.id === "pérez, ana")!;
    expect(titular.sustitucion?.sustitutoId).toBe("ruiz, eva");
    expect(titular.historialSustituciones).toEqual([
      { sustitutoId: "gómez, luis", desde: "2026-10-01", hasta: "2026-11-01" },
    ]);
  });

  it("al reincorporarse el titular, la sustitución pasa al historial con su fecha de fin", () => {
    const conBaja = iniciarSustitucionTemporal(base, {
      titularId: "pérez, ana",
      sustitutoId: "gómez, luis",
      desde: "2026-10-01",
      hasta: null,
    });
    const lista = terminarSustitucionTemporal(conBaja, "pérez, ana", HOY);
    const titular = lista.find((p) => p.id === "pérez, ana")!;
    expect(titular.sustitucion).toBeNull();
    expect(titular.historialSustituciones).toEqual([
      { sustitutoId: "gómez, luis", desde: "2026-10-01", hasta: HOY },
    ]);
    expect(esSustitutoTemporal(indiceSustituciones(lista, HOY), "gómez, luis")).toBe(false);
  });

  it("no deja una fecha de fin anterior a la de inicio", () => {
    const conBaja = iniciarSustitucionTemporal(base, {
      titularId: "pérez, ana",
      sustitutoId: "gómez, luis",
      desde: "2026-10-01",
      hasta: null,
    });
    const lista = terminarSustitucionTemporal(conBaja, "pérez, ana", "2026-09-01");
    expect(lista.find((p) => p.id === "pérez, ana")!.historialSustituciones![0].hasta).toBe(
      "2026-10-01",
    );
  });

  it("el historial completo va de la más reciente a la más antigua", () => {
    const p = prof("Pérez, Ana", {
      sustitucion: { sustitutoId: "c", desde: "2026-11-02", hasta: null },
      historialSustituciones: [
        { sustitutoId: "a", desde: "2026-09-10", hasta: "2026-09-30" },
        { sustitutoId: "b", desde: "2026-10-01", hasta: "2026-11-01" },
      ],
    });
    expect(historialCompleto(p).map((s) => s.sustitutoId)).toEqual(["c", "b", "a"]);
  });
});

describe("validación", () => {
  const base = [
    prof("Pérez, Ana"),
    prof("Gómez, Luis"),
    prof("Ruiz, Eva", { activo: false }),
    prof("Soler, Mar", {
      sustitucion: { sustitutoId: "gómez, luis", desde: "2026-10-01", hasta: null },
    }),
  ];
  const datos = (extra: Partial<Parameters<typeof validarSustitucionTemporal>[1]> = {}) => ({
    titularId: "pérez, ana",
    sustitutoId: "gómez, luis",
    desde: "2026-11-01",
    hasta: null,
    ...extra,
  });

  it("acepta una sustitución normal", () => {
    expect(validarSustitucionTemporal(base, datos(), HOY)).toEqual([]);
  });

  it("rechaza sustituirse a uno mismo", () => {
    const errores = validarSustitucionTemporal(base, datos({ sustitutoId: "pérez, ana" }), HOY);
    expect(errores.join(" ")).toContain("sí mismo");
  });

  it("rechaza que sustituya alguien que está de baja temporal", () => {
    const errores = validarSustitucionTemporal(base, datos({ sustitutoId: "soler, mar" }), HOY);
    expect(errores.join(" ")).toContain("está de baja temporal");
  });

  it("rechaza a un profesor archivado como sustituto", () => {
    const errores = validarSustitucionTemporal(base, datos({ sustitutoId: "ruiz, eva" }), HOY);
    expect(errores.join(" ")).toContain("archivado");
  });

  it("rechaza fechas imposibles", () => {
    expect(validarSustitucionTemporal(base, datos({ desde: "2026-02-30" }), HOY).join(" ")).toContain(
      "fecha de inicio",
    );
    expect(
      validarSustitucionTemporal(base, datos({ hasta: "2026-10-01" }), HOY).join(" "),
    ).toContain("anterior a la de inicio");
  });

  it("avisa de que el sustituto ya cubre a otro titular", () => {
    const avisos = avisosSustitucionTemporal(base, datos(), HOY);
    expect(avisos.join(" ")).toContain("Soler, Mar");
  });
});

describe("saneado y renombrado", () => {
  it("descarta sustituciones sin sustituto o con fecha inválida", () => {
    expect(sanearSustitucion({ sustitutoId: "", desde: "2026-10-01" })).toBeNull();
    expect(sanearSustitucion({ sustitutoId: "x", desde: "no-es-fecha" })).toBeNull();
    expect(sanearSustitucion({ sustitutoId: "x", desde: "2026-10-01", hasta: "" })).toEqual({
      sustitutoId: "x",
      desde: "2026-10-01",
      hasta: null,
    });
  });

  it("ordena el historial por fecha de inicio", () => {
    const historial = sanearHistorial([
      { sustitutoId: "b", desde: "2026-10-01", hasta: null },
      { sustitutoId: "a", desde: "2026-09-01", hasta: "2026-09-30" },
      "basura",
    ]);
    expect(historial.map((s) => s.sustitutoId)).toEqual(["a", "b"]);
  });

  it("al renombrar a un sustituto, las sustituciones le siguen", () => {
    const lista = [
      prof("Pérez, Ana", {
        sustitucion: { sustitutoId: "gómez, luis", desde: "2026-10-01", hasta: null },
        historialSustituciones: [{ sustitutoId: "gómez, luis", desde: "2026-09-01", hasta: "2026-09-30" }],
      }),
      prof("Gómez Soto, Luis", { id: "gómez soto, luis" }),
    ];
    const renombrada = renombrarEnSustituciones(lista, "gómez, luis", "gómez soto, luis");
    const titular = renombrada[0];
    expect(titular.sustitucion?.sustitutoId).toBe("gómez soto, luis");
    expect(titular.historialSustituciones![0].sustitutoId).toBe("gómez soto, luis");
  });
});
