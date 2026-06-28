import { asciiSumAsig, idCompuesto } from "../asigId";

describe("asciiSumAsig", () => {
  it("calcula correctamente la suma de códigos ASCII de 'Piano'", () => {
    // P=80 i=105 a=97 n=110 o=111 → 503
    expect(asciiSumAsig("Piano")).toBe(503);
  });

  it("calcula correctamente la suma de 'Lenguaje Musical'", () => {
    // L76 e101 n110 g103 u117 a97 j106 e101 ' '32 M77 u117 s115 i105 c99 a97 l108 → 1561
    expect(asciiSumAsig("Lenguaje Musical")).toBe(1561);
  });

  it("devuelve 0 para cadena vacía", () => {
    expect(asciiSumAsig("")).toBe(0);
  });

  it("es sensible a mayúsculas ('piano' ≠ 'Piano')", () => {
    expect(asciiSumAsig("piano")).not.toBe(asciiSumAsig("Piano"));
    // p=112 i=105 a=97 n=110 o=111 → 535
    expect(asciiSumAsig("piano")).toBe(535);
  });

  it("distingue correctamente caracteres especiales como tildes", () => {
    // 'Violín': V73 i105 o111 l108 í237 n110 → 744
    const sum = asciiSumAsig("Violín");
    expect(sum).toBeGreaterThan(0);
    expect(sum).not.toBe(asciiSumAsig("Violin"));
  });

  it("incluye espacios en el cómputo", () => {
    // 'A B' ≠ 'AB'
    expect(asciiSumAsig("A B")).not.toBe(asciiSumAsig("AB"));
    expect(asciiSumAsig("A B")).toBe(65 + 32 + 66); // A+space+B = 163
  });
});

describe("idCompuesto", () => {
  it("combina nOrden y asciiSum con guion bajo", () => {
    expect(idCompuesto(905, "Piano")).toBe("905_503");
    expect(idCompuesto(435, "Lenguaje Musical")).toBe("435_1561");
  });

  it("nOrden=null produce '0' como prefijo", () => {
    expect(idCompuesto(null, "Piano")).toBe("0_503");
  });

  it("mismo asciiSum para la misma asignatura con distintos nOrden", () => {
    const id905 = idCompuesto(905, "Piano");
    const id435 = idCompuesto(435, "Piano");
    // El sufijo (asciiSum) es el mismo, el prefijo (nOrden) cambia
    expect(id905.split("_")[1]).toBe(id435.split("_")[1]);
    expect(id905.split("_")[0]).not.toBe(id435.split("_")[0]);
  });

  it("dos asignaturas distintas producen IDs distintos con el mismo nOrden", () => {
    expect(idCompuesto(42, "Piano")).not.toBe(idCompuesto(42, "Lenguaje Musical"));
  });

  it("asignatura vacía produce un ID con sufijo 0", () => {
    expect(idCompuesto(100, "")).toBe("100_0");
  });
});
