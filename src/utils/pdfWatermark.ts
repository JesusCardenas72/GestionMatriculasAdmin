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
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
  opacity: 0.05;
">
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <text
      x="50%" y="48%"
      text-anchor="middle"
      dominant-baseline="middle"
      transform="rotate(-45, 50%, 50%)"
      font-family="Arial Black, Arial, sans-serif"
      font-weight="900"
      font-size="88"
      fill="none"
      stroke="#bb0000"
      stroke-width="2"
      letter-spacing="4"
    >${linea1}</text>
    <text
      x="50%" y="58%"
      text-anchor="middle"
      dominant-baseline="middle"
      transform="rotate(-45, 50%, 50%)"
      font-family="Arial Black, Arial, sans-serif"
      font-weight="900"
      font-size="64"
      fill="none"
      stroke="#bb0000"
      stroke-width="1.5"
      letter-spacing="4"
    >${linea2}</text>
  </svg>
</div>`;

  // Insertar justo antes de </body>; si no hay body, añadir al final
  if (html.includes("</body>")) {
    return html.replace("</body>", `${watermark}\n</body>`);
  }
  return html + watermark;
}
