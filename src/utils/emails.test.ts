import { emailsNoValidos, separarEmails, unirDestinatarios } from "./emails";

describe("separarEmails", () => {
  it("una sola dirección", () => {
    expect(separarEmails("ana@x.com")).toEqual(["ana@x.com"]);
  });

  it("separa por coma y espacio, coma o punto y coma", () => {
    expect(separarEmails("ana@x.com, padre@y.com")).toEqual(["ana@x.com", "padre@y.com"]);
    expect(separarEmails("ana@x.com,padre@y.com; madre@z.com")).toEqual([
      "ana@x.com",
      "padre@y.com",
      "madre@z.com",
    ]);
  });

  it("ignora huecos vacíos y repetidas", () => {
    expect(separarEmails(" ana@x.com , , ANA@x.com, ")).toEqual(["ana@x.com"]);
  });

  it("vacío o nulo", () => {
    expect(separarEmails("")).toEqual([]);
    expect(separarEmails(null)).toEqual([]);
    expect(separarEmails(undefined)).toEqual([]);
  });
});

describe("destinatarios del correo", () => {
  it("el de la matrícula más los escritos aparte, sin repetir", () => {
    expect(unirDestinatarios("ana@x.com", true, "padre@y.com")).toBe("ana@x.com, padre@y.com");
    expect(unirDestinatarios("ana@x.com", true, "ANA@x.com; madre@z.es")).toBe("ana@x.com, madre@z.es");
    expect(unirDestinatarios("ana@x.com, tutor@x.com", true, "")).toBe("ana@x.com, tutor@x.com");
  });

  it("sin el de la matrícula, solo los escritos", () => {
    expect(unirDestinatarios("ana@x.com", false, "padre@y.com")).toBe("padre@y.com");
    expect(unirDestinatarios("ana@x.com", false, "")).toBe("");
  });

  it("detecta direcciones mal escritas", () => {
    expect(emailsNoValidos("padre@y.com, madre@, hola")).toEqual(["madre@", "hola"]);
    expect(emailsNoValidos("")).toEqual([]);
  });
});
