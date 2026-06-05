import { useEffect, useRef } from "react";
import type { MatriculaLocal } from "../api/types";
import { formatearMatriculaLocal } from "../utils/formatText";

export type ListarLocal = (curso: string) => Promise<MatriculaLocal[]>;
export type ActualizarLocal = (
  curso: string,
  localId: string,
  changes: Partial<MatriculaLocal>,
) => Promise<unknown>;

export async function migrarTextosLocal(
  cursos: string[],
  listar: ListarLocal,
  actualizar: ActualizarLocal,
): Promise<number> {
  let count = 0;
  for (const curso of cursos) {
    try {
      const records = await listar(curso);
      for (const record of records) {
        if (record.textoFormateado === true) continue;
        const formatted = formatearMatriculaLocal(record);
        await actualizar(curso, record.localId, {
          nombre: formatted.nombre,
          apellidos: formatted.apellidos,
          domicilio: formatted.domicilio,
          localidad: formatted.localidad,
          provincia: formatted.provincia,
          textoFormateado: true,
        });
        count++;
      }
    } catch (err) {
      console.error(`[Migración texto] Error en curso ${curso}:`, err);
    }
  }
  return count;
}

export function useMigracionTextoLocal(cursos: string[]) {
  const cursosMigrados = useRef(new Set<string>());

  useEffect(() => {
    if (cursos.length === 0) return;

    const pendientes = cursos.filter((c) => !cursosMigrados.current.has(c));
    if (pendientes.length === 0) return;

    for (const curso of pendientes) {
      cursosMigrados.current.add(curso);
    }

    void migrarTextosLocal(
      pendientes,
      (curso) => window.adminAPI.cursos.listar(curso),
      (curso, localId, changes) =>
        window.adminAPI.cursos.actualizar(curso, localId, changes),
    );
  }, [cursos]);
}
