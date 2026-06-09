/**
 * Inyecta una marca de agua diagonal en un documento HTML antes de
 * convertirlo a PDF con Chromium/Electron printToPDF.
 *
 * Usa `position: fixed` para que aparezca en TODAS las páginas.
 * La opacidad 0.20 deja el contenido perfectamente legible.
 */
export function addWatermarkToHtml(html: string, linea1: string, linea2: string): string {
  const watermark = `
<div style="
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 99999;
  overflow: hidden;
">
  <div style="
    transform: rotate(-45deg);
    transform-origin: center center;
    text-align: center;
    white-space: nowrap;
    font-family: Arial Black, Arial, sans-serif;
    font-weight: 900;
    color: #bb0000;
    opacity: 0.20;
    line-height: 1.15;
    letter-spacing: 4px;
    padding: 0;
    margin: 0;
  ">
    <div style="font-size: 88px;">${linea1}</div>
    <div style="font-size: 64px;">${linea2}</div>
  </div>
</div>`;

  // Insertar justo antes de </body>; si no hay body, añadir al final
  if (html.includes("</body>")) {
    return html.replace("</body>", `${watermark}\n</body>`);
  }
  return html + watermark;
}
