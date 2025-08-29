// lib/pdf/actividadInformeHTML.ts
import { GEIST_REG_TTF_BASE64 } from "./fonts/geist-regular.base64";
import { GEIST_BOLD_TTF_BASE64 } from "./fonts/geist-bold.base64";
import sanitizeHtml from "sanitize-html";

/* =========== helpers =========== */
const esc = (s: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const isLikelyHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

/** Texto plano → HTML con <p> / <br>, como en el dialog */
const toHtml = (plain: string) =>
  `<p>${(plain ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => (p.trim().length ? p.trim().replace(/\n/g, "<br>") : "<br>"))
    .join("</p><p>")}</p>`;

/** Quita etiquetas dejando texto plano (+ normaliza &nbsp;) */
const stripHtmlToText = (html?: string) =>
  String(html ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Sanitizado flexible (permite data-*, class, style) */
const sanitizeRich = (html: string) =>
  sanitizeHtml((html ?? "").replace(/&nbsp;/g, " "), {
    allowedTags: [
      "div","p","strong","em","u","s","blockquote","ul","ol","li","br","hr",
      "h1","h2","h3","h4","h5","h6","span","a","code","pre","table","thead","tbody","tr","th","td"
    ],
    // Permitimos class/style y CUALQUIER data-*
    allowedAttributes: {
      "*": [
        "class",
        "style",
        { name: /^data-[\w-]+$/ } as any,
      ],
      a: ["href", "target", "rel"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$|^right$|^center$|^justify$/],
        "font-weight": [/^\d+$/],
        "font-style": [/^italic$|^normal$/],
      },
    },
    transformTags: {
      b: "strong",
      i: "em",
      a: (tag, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });

/** Fallback “laxo”: elimina scripts y on*= pero no toca el resto (para imprimir) */
const sanitizeLax = (raw: string) => {
  const stripped = String(raw)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/&nbsp;/g, " ");
  return sanitizeHtml(stripped, {
    allowedTags: false,
    allowedAttributes: {
      "*": [
        "class",
        "style",
        { name: /^data-[\w-]+$/ } as any,
      ],
      a: ["href", "target", "rel"],
    },
    transformTags: {
      a: (tag, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });
};

/** Sanitiza con fallback: si queda vacío, usa laxo; si aún así vacío, reconstruye como texto plano */
const safeSanitizeWithFallback = (raw: string) => {
  const primary = sanitizeRich(raw);
  if (stripHtmlToText(primary).length > 0) return primary;

  const lax = sanitizeLax(raw);
  if (stripHtmlToText(lax).length > 0) return lax;

  const fromPlain = toHtml(stripHtmlToText(raw));
  const cleaned = sanitizeRich(fromPlain);
  return cleaned || "<p>Sin contenido</p>";
};

const fmtFechaES = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleDateString("es-ES", {
    day: "numeric", month: "long", year: "numeric",
  });

/* ======== Helpers para CE (alineados con DialogVerActividad) ======== */
const normCE = (s?: string) =>
  String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-"); // normaliza guiones especiales

type StrMap = Record<string, string>;

function materializeRaByCe(input?: Map<string,string> | StrMap | [string,string][]) {
  const out: StrMap = {};
  if (!input) return out;
  if (input instanceof Map) {
    for (const [k, v] of input.entries()) out[normCE(k)] = String(v ?? "");
  } else if (Array.isArray(input)) {
    for (const [k, v] of input) out[normCE(k)] = String(v ?? "");
  } else {
    for (const k of Object.keys(input)) out[normCE(k)] = String((input as StrMap)[k] ?? "");
  }
  return out;
}

const labelForFactory = (raByCe: StrMap) => (ceCode?: string) => {
  const key = normCE(ceCode);
  const ra = raByCe[key] || "RA?";
  return `${ra} · ${key}`;
};

const getCeTextFactory = (ceDescByCode: StrMap) => (r: any) => {
  const raw = String((r?.descripcion ?? r?.texto ?? "") || "").trim();
  // ⬇️ si viene un placeholder, trátalo como vacío
  if (raw && raw !== "—" && raw !== "-") return raw;
  return (ceDescByCode[normCE(r?.codigo)] || "").trim();
};

/* =========== builder =========== */
export function buildActividadHTML(
  data: any,
  opts?: { headerTitle?: string }
) {
  const {
    titulo = "Actividad",
    fechaISO,
    asignatura = "—",

    // Descripción: prioriza la que envías desde el Dialog
    descripcion,
    descripcionHTML,
    descripcionHtml, // 👈
    enunciado,
    texto,

    umbral = 0,
    ces = [],

    // OPCIONALES, para mantener 1:1 con DialogVerActividad:
    // raByCe: Map<string,string> | Record<string,string> | [code, ra][],
    // ceDescByCode: Record<string,string>
    raByCe: raByCeInput,
    ceDescByCode: ceDescByCodeInput,
  } = data ?? {};

  // 1) Fuente de descripción
  const rawDesc: string =
    descripcionHtml ??
    descripcionHTML ??
    descripcion ??
    enunciado ??
    texto ??
    "";

  // 2) Si no parece HTML, conviértelo
  const htmlDescSource = isLikelyHtml(rawDesc) ? rawDesc : toHtml(rawDesc || "");

  // 3) Sanitiza con fallback (muy difícil que quede vacío)
  const descripcionHTMLFinal = safeSanitizeWithFallback(htmlDescSource);

  const fechaStr = fmtFechaES(fechaISO);
  const headerTitle = opts?.headerTitle ?? "Actividad evaluativa";

  // Mapas/funciones iguales que en el dialog
  const raByCe = materializeRaByCe(raByCeInput as any);
  const ceDescByCode: StrMap = { ...(ceDescByCodeInput ?? {}) };
  const labelFor = labelForFactory(raByCe);
  const getCeText = getCeTextFactory(ceDescByCode);

  // ===== Normaliza CE para la tabla (misma lógica que el dialog)
  const filtrados = (ces ?? [])
    .map((ce: any) => {
      const similitud = Number(
        ce.puntuacion ?? ce.similitud ?? ce.score ?? ce.similarity ?? 0
      );
      const similitudPct =
        Math.round(similitud * (similitud <= 1 ? 100 : 1)) || 0;

      // Código / etiqueta / RA
      const codigo = ce.codigo ?? ce.ceCodigo ?? ce.ce_codigo ?? ce.code ?? "";
      const etiqueta = labelFor(codigo);          // "RAx · CEy.z"
      const raSolo = etiqueta.split("·")[0].trim(); // "RAx"

      // Descripción coherente con el dialog
      const desc = (getCeText(ce) || "").trim();
return {
  _codigo: normCE(codigo),
  _ra: raSolo || "RA?",
  _textoCE: desc || "—",     // ← solo pone "—" si no hay nada ni en mapa ni en campos
  similitudPct,
};
    })
    .filter((ce: any) => ce.similitudPct >= Number(umbral));

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Informe actividad</title>
<style>
  @page { size: A4; margin: 18mm 12mm 20mm 12mm; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @font-face {
    font-family: "Geist";
    src: url(data:font/ttf;base64,${GEIST_REG_TTF_BASE64}) format("truetype");
    font-weight: 400; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: "Geist";
    src: url(data:font/ttf;base64,${GEIST_BOLD_TTF_BASE64}) format("truetype");
    font-weight: 700; font-style: normal; font-display: swap;
  }
  body {
    font-family: "Geist", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 11.5pt; color: #111; line-height: 1.35; margin: 0;
  }
  .pdf-header {
    position: fixed; top: 0; left: 0; right: 0; height: 40px;
    padding: 0 18mm; display: flex; align-items: center; justify-content: space-between;
    font-weight: 700; font-size: 10pt; border-bottom: 1px solid #e6e6e6; background: white;
  }
  .pdf-footer {
    position: fixed; bottom: 0; left: 0; right: 0; height: 24px;
    padding: 0 18mm; display: flex; align-items: center; justify-content: flex-end;
    font-size: 10pt;
  }
  .content { padding: 56px 10mm 28px; }

  h1 { font-weight: 700; font-size: 24pt; margin: 0 0 10pt 0; letter-spacing: -0.3pt; }
  h2 { font-weight: 700; font-size: 14pt; margin: 0 0 8pt 0; }
  .meta { color: #555; font-size: 11.5pt; margin: 0 0 12pt 0; }
  .section-title { font-weight: 700; font-size: 12pt; margin: 2pt 0 6pt; }

  .descripcion { white-space: normal; margin-bottom: 8pt; }
  .descripcion p { margin: 0 0 6pt 0; }
  .descripcion blockquote { margin: 0 0 8pt 0; padding-left: 10pt; border-left: 2px solid #e5e5e5; }
  .descripcion ul, .descripcion ol { margin: 0 0 8pt 18pt; }

  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  thead th { text-align: left; padding: 6pt; border-bottom: 1px solid #e5e5e5; font-weight: 700; background: #f5f5f5; }
  tbody td { padding: 6pt; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafafa; }

  .w-ce { width: 90pt; }
  .w-ra { width: 70pt; }
  .w-desc { width: auto; }
  .w-sim { width: 70pt; text-align: right; }

  p, h1, h2, .section-title { page-break-inside: avoid; }
  table, tr, td, th { page-break-inside: avoid; }
</style>
</head>
<body>
<div class="pdf-header">
<div>${esc(asignatura)}</div>
<div>${esc(fechaStr)}</div>
</div>

  <div class="pdf-footer"><div class="page-num"></div></div>

  <div class="content">
    <h1>${esc(headerTitle)}</h1>
    <h2>${esc(titulo)}</h2>
    <p class="meta">Umbral aplicado: ${umbral}%</p>

    <div class="section-title">Descripción</div>
    <div class="descripcion">${descripcionHTMLFinal}</div>

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
                <td class="w-ce">${esc(ce._codigo || "—")}</td>
                <td class="w-ra">${esc(ce._ra || "—")}</td>
                <td class="w-desc">${esc(ce._textoCE)}</td>
                <td class="w-sim">${ce.similitudPct}%</td>
              </tr>`).join("")
            : `<tr><td colspan="4">No hay CE que cumplan el umbral</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <script>
    (function(){
      try {
        const nodes = document.querySelectorAll('.page-num');
        nodes.forEach((n, i) => n.textContent = "Página " + (i+1));
      } catch {}
    })();
  </script>
</body>
</html>`;
}
