import { useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import alumnadoFantasmaIco from "../../../public/AlumnadoFantasma.ico";
import type { CargaHorarios } from "../../horarios/types";
import { useLocalMatriculas } from "../../hooks/useLocalMatriculas";
import { useAppMode } from "../../contexts/AppModeProvider";
import { contarTemporales } from "../../utils/asistenteTemporales";
import { GuiaAlumnosTemporalesModal } from "../../screens/GuiaAlumnosTemporalesModal";
import { CabeceraApartado } from "./Comunes";
import { CrearAlumnadoFantasma } from "./CrearAlumnadoFantasma";
import { ListaAlumnadoFantasma } from "./ListaAlumnadoFantasma";
import { GenerarExcelHorarios } from "./GenerarExcelHorarios";
import { CargarExcelHorarios } from "./CargarExcelHorarios";

/**
 * Pestaña Horarios → Excel de Horarios. Reúne todo el ciclo del Excel que antes
 * estaba repartido entre la pestaña Alumnado Fantasma (asistente de 3 pasos) y
 * Horarios Individuales:
 *
 *   1 · Alumnado fantasma   (izquierda: alta + lista, con su propio desplazamiento)
 *   2 · Generar el Excel    (derecha, arriba)
 *   3 · Cargar el Excel     (derecha, abajo)
 *
 * En la caja de Alumnado fantasma solo se desplazan las filas de la lista; el
 * resto (cabecera, formulario, contadores y filtros) queda fijo. Para eso la caja
 * tiene siempre un alto acotado: el de la pantalla en dos columnas (desde 1024 px)
 * y, en ventanas más estrechas, donde las columnas van una debajo de otra, el
 * alto visible menos la cabecera de la app.
 * Los apartados no se bloquean entre sí: el orden lo marca la numeración.
 */
export function ExcelHorariosPanel({
  curso,
  carga,
  cargando,
  onCargar,
  onBorrar,
  onVerIndividuales,
  onIrAProfesorado,
}: {
  curso: string;
  carga: CargaHorarios | null;
  cargando: boolean;
  onCargar: () => Promise<string | null>;
  onBorrar: () => Promise<void>;
  onVerIndividuales: () => void;
  onIrAProfesorado?: () => void;
}) {
  const { isSoloLectura } = useAppMode();
  const { matriculas, isLoading, guardarLote, actualizar, eliminar } = useLocalMatriculas(curso);
  const [showGuia, setShowGuia] = useState(false);
  const { nTemporales, nPendientes } = useMemo(() => contarTemporales(matriculas), [matriculas]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-5">
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:h-full">
        {/* 1 · Alumnado fantasma (alto acotado: solo se desplaza la lista) */}
        <section className="bg-[var(--tc-card)] rounded-2xl border border-[var(--tc-border)] shadow-sm p-5 flex flex-col gap-4 h-[calc(100vh-11rem)] min-h-[480px] lg:h-auto lg:min-h-0 overflow-y-auto">
          <CabeceraApartado
            n={1}
            icono={<img src={alumnadoFantasmaIco} alt="" className="h-[46px] w-auto" />}
            titulo="Alumnado fantasma"
            estado={
              nTemporales === 0
                ? "Aún no hay alumnos fantasma en este curso."
                : `${nTemporales} creados · ${nPendientes} pendientes de matrícula`
            }
            acciones={
              <button
                onClick={() => setShowGuia(true)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[var(--tc-border)] text-xs font-medium text-[var(--tc-primary)] hover:bg-[var(--tc-primary-tint)] transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                ¿Cómo funciona?
              </button>
            }
          />
          <p className="text-[12px] text-[var(--tc-ink-mute)] leading-relaxed -mt-2">
            Plazas previstas por curso y especialidad para que el profesorado pueda poner horario antes de que el
            alumnado se matricule. Salen en el Excel como «PDTE. N — Especialidad Curso» con fondo naranja.
          </p>
          <div className="shrink-0">
            <CrearAlumnadoFantasma
              curso={curso}
              matriculas={matriculas}
              guardarLote={guardarLote}
              disabled={isSoloLectura}
            />
          </div>
          <div className="border-t border-[var(--tc-border-soft)] pt-4 flex-1 min-h-0 flex flex-col">
            <ListaAlumnadoFantasma
              curso={curso}
              matriculas={matriculas}
              isLoading={isLoading}
              actualizar={actualizar}
              eliminar={eliminar}
            />
          </div>
        </section>

        {/* 2 · Generar  ·  3 · Cargar */}
        <div className="flex flex-col gap-5 min-h-0 lg:overflow-y-auto">
          <GenerarExcelHorarios
            curso={curso}
            matriculas={matriculas}
            actualizar={actualizar}
            disabled={isSoloLectura}
            hayHorariosGuardados={(carga?.alumnos.length ?? 0) > 0}
            onIrAProfesorado={onIrAProfesorado}
          />
          <CargarExcelHorarios
            curso={curso}
            matriculas={matriculas}
            carga={carga}
            cargando={cargando}
            disabled={isSoloLectura}
            onCargar={onCargar}
            onBorrar={onBorrar}
            onVerIndividuales={onVerIndividuales}
          />
          <p className="text-[11px] text-[var(--tc-ink-mute)] leading-relaxed px-1">
            El ciclo se repite: según llegan matrículas, vincúlalas en Local con su alumno fantasma, vuelve a
            generar el Excel (sale ya con los horarios cargados) y carga el que te devuelva el profesorado.
          </p>
        </div>
      </div>

      {showGuia && <GuiaAlumnosTemporalesModal onCerrar={() => setShowGuia(false)} />}
    </div>
  );
}
