import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notasDesdeFilas, type LecturaNotas } from "../utils/becasNotas";
import { cursoAnterior, type DecisionNotas } from "../utils/comprobarNotas";
import { leerArchivoProfesorado } from "../utils/profesoradoArchivo";

/**
 * Notas del curso anterior (CSV de Delphos) guardadas para el curso en vigor y
 * las decisiones tomadas a mano al comprobar cada matrícula (por rowId).
 */
export interface NotasAnteriores {
  fileName: string;
  cargadoEn: string;
  lectura: LecturaNotas;
}

const claveNotas = (curso: string) => ["notasAnteriores", curso] as const;
const claveDecisiones = (curso: string) =>
  ["notasAnteriores", curso, "decisiones"] as const;

/**
 * Elige el CSV, lo lee y comprueba que es del curso anterior. Devuelve un
 * mensaje de error si no vale (no se guarda nada) o null si se ha guardado.
 */
async function cargarArchivo(curso: string): Promise<string | null> {
  const archivo = await window.adminAPI.informe.seleccionarArchivo(["csv"]);
  if (!archivo) return null;
  const { filas } = await leerArchivoProfesorado(
    archivo.base64,
    archivo.fileName,
  );
  const lectura = notasDesdeFilas(filas);
  if (lectura.matriculas.length === 0) {
    return lectura.avisos[0] ?? "El archivo no trae ninguna nota.";
  }
  const anterior = cursoAnterior(curso);
  if (anterior && lectura.anno !== anterior.anno) {
    const pad = (n: number) => String(n % 100).padStart(2, "0");
    const inicio = Number(lectura.anno);
    const de = lectura.anno
      ? `del curso ${pad(inicio)}/${pad(inicio + 1)}`
      : "de varios cursos";
    return `El archivo es ${de} y se esperaba el ${anterior.texto}. Elige el archivo de notas del curso anterior.`;
  }
  await window.adminAPI.notasAnteriores.guardar(curso, {
    fileName: archivo.fileName,
    cargadoEn: new Date().toISOString(),
    lectura,
  });
  return null;
}

export function useNotasAnteriores(curso: string) {
  const qc = useQueryClient();

  const notas = useQuery({
    queryKey: claveNotas(curso),
    queryFn: async () =>
      ((await window.adminAPI.notasAnteriores.obtener(
        curso,
      )) as NotasAnteriores | null) ?? null,
    enabled: !!curso,
    staleTime: Infinity,
  });

  const decisiones = useQuery({
    queryKey: claveDecisiones(curso),
    queryFn: async () =>
      (await window.adminAPI.notasAnteriores.decisiones(curso)) as Record<
        string,
        DecisionNotas
      >,
    enabled: !!curso,
    staleTime: Infinity,
  });

  const cargar = useMutation({
    mutationFn: () => cargarArchivo(curso),
    onSuccess: () => qc.invalidateQueries({ queryKey: claveNotas(curso) }),
  });

  const guardarDecision = useMutation({
    mutationFn: ({
      rowId,
      decision,
    }: {
      rowId: string;
      decision: DecisionNotas | null;
    }) =>
      window.adminAPI.notasAnteriores.guardarDecision(curso, rowId, decision),
    onSuccess: (todas) => qc.setQueryData(claveDecisiones(curso), todas),
  });

  return { notas, decisiones, cargar, guardarDecision };
}
