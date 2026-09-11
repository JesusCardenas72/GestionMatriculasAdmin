import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";

/** Piezas compartidas por los apartados de la pestaña Horarios → Excel de Horarios. */

export function MensajeOk({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 flex items-start gap-2">
      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="whitespace-pre-line">{texto}</span>
    </div>
  );
}

export function MensajeError({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="whitespace-pre-line">{texto}</span>
    </div>
  );
}

/**
 * Cabecera numerada de cada apartado (1 · Alumnado fantasma, 2 · Generar,
 * 3 · Cargar). `estado` es la línea corta con lo último que se hizo.
 */
export function CabeceraApartado({
  n,
  titulo,
  estado,
  icono,
  acciones,
}: {
  n: number;
  titulo: string;
  estado?: ReactNode;
  /** Imagen junto al número, con la altura de las dos líneas (título + estado). */
  icono?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--tc-primary-tint)] text-[var(--tc-primary)] flex items-center justify-center text-sm font-bold">
        {n}
      </div>
      {icono && <div className="shrink-0 h-[46px] flex items-center">{icono}</div>}
      <div className="flex-1 min-w-0">
        <h2 className="font-display text-xl font-light text-[var(--tc-ink)] tracking-tight leading-7">{titulo}</h2>
        {estado && <p className="text-[12px] text-[var(--tc-ink-soft)] mt-0.5">{estado}</p>}
      </div>
      {acciones && <div className="shrink-0 flex items-center gap-2">{acciones}</div>}
    </div>
  );
}
