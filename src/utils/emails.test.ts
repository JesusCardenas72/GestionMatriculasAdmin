import { separarEmails } from "./emails";

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
