// lib/pdf/actividadInformeHTML.ts
import { ActividadInformeInput } from "./pdf.types";
import { GEIST_REG_TTF_BASE64 } from "./fonts/geist-regular.base64";
import { GEIST_BOLD_TTF_BASE64 } from "./fonts/geist-bold.base64";

const fmtFechaES = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const esc = (s: string) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function buildActividadHTML(data: ActividadInformeInput, opts?: { headerTitle?: string }) {
  const {
    titulo = "Actividad",
    fechaISO,
    asignatura = "—",
    descripcion = "",
    umbral = 0,
    ces = [],
  } = data;

  const fechaStr = fmtFechaES(fechaISO);
  const headerTitle = opts?.headerTitle ?? "Actividad evaluativa";

  const filtrados = (ces ?? [])
    .map((ce: any) => ({ ...ce, similitudPct: Math.round((ce.similitud ?? 0) * 100) }))
    .filter((ce: any) => ce.similitudPct >= umbral);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Informe actividad</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm 18mm; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Fuentes embebidas */
  @font-face {
    font-family: "Geist";
    src: url(data:font/ttf;base64,${GEIST_REG_TTF_BASE64}) format("truetype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Geist";
    src: url(data:font/ttf;base64,${GEIST_BOLD_TTF_BASE64}) format("truetype");
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  body {
    font-family: "Geist", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 11.5pt; color: #111; line-height: 1.35;
    margin: 0;
  }
  /* Header & Footer fijos y repetidos en todas las páginas */
  .pdf-header {
    position: fixed; top: 0; left: 0; right: 0; height: 40px;
    padding: 0 18mm; display: flex; align-items: center; justify-content: space-between;
    font-weight: 700; font-size: 10pt; border-bottom: 1px solid #e6e6e6; background: white;
  }
  .pdf-footer {
    position: fixed; bottom: 0; left: 0; right: 0; height: 24px;
    padding: 0 18mm; display: flex; align-items: center; justify-content: flex-end;
    font-size: 10pt; border-top: 1px solid #fff; /* opcional */
  }
  /* Empuje para no tapar header/footer */
  .content { padding: 56px 18mm 28px; }

  h1 {
    font-weight: 700; font-size: 24pt; margin: 0 0 10pt 0; letter-spacing: -0.3pt;
  }
  h2 {
    font-weight: 700; font-size: 14pt; margin: 0 0 8pt 0;
  }
  .meta { color: #555; font-size: 11pt; margin: 0 0 12pt 0; }
  .section-title { font-weight: 700; font-size: 12pt; margin: 2pt 0 6pt; }

  .descripcion { white-space: pre-wrap; margin-bottom: 8pt; }

  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  thead th {
    text-align: left; padding: 6pt; border-bottom: 1px solid #e5e5e5;
    font-weight: 700; background: #f5f5f5;
  }
  tbody td { padding: 6pt; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafafa; }

  .w-ce   { width: 90pt; }
  .w-ra   { width: 70pt; }
  .w-desc { width: auto; }
  .w-sim  { width: 70pt; text-align: right; }

  /* Tiny util para evitar viudas/huérfanas muy feas */
  p, h1, h2, .section-title { page-break-inside: avoid; }
  table, tr, td, th { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="pdf-header">
    <div>${esc(asignatura)}</div>
    <div>${esc(fechaStr)}</div>
  </div>

  <div class="pdf-footer">
    <div class="page-num"></div>
  </div>

  <div class="content">
    <h1>${esc(headerTitle)}</h1>
    <h2>${esc(titulo)}</h2>
    <p class="meta">Umbral aplicado: ${umbral}%</p>

    <div class="section-title">Descripción</div>
    <div class="descripcion">${esc(descripcion)}</div>

    <div class="section-title">Criterios de Evaluación incluidos</div>
    <table>
      <thead>
        <tr>
          <th class="w-ce">Código CE</th>
          <th class="w-ra">RA</th>
          <th class="w-desc">Descripción</th>
          <th class="w-sim">Similitud</th>
        </tr>
      </thead>
      <tbody>
        ${
          filtrados.length
            ? filtrados.map((ce: any) => `
              <tr>
                <td class="w-ce">${esc(ce.codigo || "—")}</td>
                <td class="w-ra">${esc(ce.ra || "—")}</td>
                <td class="w-desc">${esc(ce.texto || "—")}</td>
                <td class="w-sim">${ce.similitudPct}%</td>
              </tr>`).join("")
            : `<tr><td colspan="4">No hay CE que cumplan el umbral</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <script>
    // Numeración de página con CSSOM (Chromium repite header/footer fixed en cada página)
    function updatePageNumbers() {
      try {
        const total = window.__TOTAL_PAGES__ || null; // opcional si integras desde fuera
        const nodes = document.querySelectorAll('.page-num');
        // Cuando Chrome imprime, no hay API directa para total; mostramos "Página X" o "X / ?"
        nodes.forEach((n, i) => n.textContent = total ? ("Página " + (i+1) + " de " + total) : ("Página " + (i+1)));
      } catch (e) {}
    }
    updatePageNumbers();
  </script>
</body>
</html>`;
}
