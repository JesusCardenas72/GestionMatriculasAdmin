import type { ReactNode } from "react";

interface Props {
  /** Fila de la ampliación: la matrícula en vigor. */
  ampliacion: ReactNode;
  /** Fila de la matrícula original, que la ampliación sustituye. */
  original: ReactNode;
}

/**
 * Ampliación y su matrícula original como un único bloque de la lista: arriba
 * la ampliación (la que está en vigor) y debajo, sangrada, la original. Cada
 * fila sigue siendo un botón propio, así que se puede abrir cualquiera de las
 * dos. Lo usan la lista de solicitudes y la de Local.
 */
export default function BloqueAmpliacion({ ampliacion, original }: Props) {
  return (
    <div
      data-testid="bloque-ampliacion"
      className="rounded-xl mb-1"
      style={{
        border: "1px solid var(--tc-violet-border)",
        background: "var(--tc-violet-bg)",
        padding: 3,
      }}
    >
      <div className="rounded-lg overflow-hidden" style={{ background: "var(--tc-card)" }}>
        {ampliacion}
      </div>
      <div
        style={{
          marginLeft: 18,
          marginTop: 3,
          paddingLeft: 8,
          borderLeft: "2px solid var(--tc-violet-border)",
        }}
      >
        <div
          className="font-bold uppercase"
          style={{ fontSize: 9, letterSpacing: 0.6, color: "var(--tc-violet-ink)", padding: "2px 4px 1px" }}
        >
          Matrícula original · sustituida por la ampliación
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: "var(--tc-card)", opacity: 0.75 }}>
          {original}
        </div>
      </div>
    </div>
  );
}
