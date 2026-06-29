import { useEffect, useRef } from "react";
import type { MatriculaLocal } from "../api/types";
import { toTitleCase } from "../utils/formatText";

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
        if (record.esTemporal) continue;
        const nombre = toTitleCase(record.nombre) ?? record.nombre;
        const apellidos = toTitleCase(record.apellidos) ?? record.apellidos;
        const domicilio = toTitleCase(record.domicilio) ?? record.domicilio;
        const localidad = toTitleCase(record.localidad) ?? record.localidad;
        const provincia = toTitleCase(record.provincia) ?? record.provincia;

        const textoCambio =
          nombre !== record.nombre ||
          apellidos !== record.apellidos ||
          domicilio !== record.domicilio ||
          localidad !== record.localidad ||
          provincia !== record.provincia;

        if (textoCambio) {
          const now = new Date().toISOString();
          await actualizar(curso, record.localId, {
            nombre,
            apellidos,
            domicilio,
            localidad,
            provincia,
            textoFormateado: true,
            _pendienteSubida: true,
            _modificadoEn: now,
          });
          count++;
        } else if (!record.textoFormateado) {
          await actualizar(curso, record.localId, { textoFormateado: true });
          count++;
        }
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
