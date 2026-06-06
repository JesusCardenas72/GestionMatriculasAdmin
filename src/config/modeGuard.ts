/**
 * Singleton de modo de la app, accesible fuera del árbol React (capa API).
 * Se actualiza desde AppModeProvider vía setSoloLectura().
 */
let _soloLectura = false;

export function setSoloLectura(v: boolean): void {
  _soloLectura = v;
}

export function assertEscribible(operacion?: string): void {
  if (_soloLectura) {
    throw new Error(
      operacion
        ? `Operación bloqueada en modo Solo Lectura: ${operacion}`
        : "Operación bloqueada en modo Solo Lectura",
    );
  }
}
