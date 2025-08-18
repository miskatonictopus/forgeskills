"use client";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useState } from "react";

type Props = {
  data: any;
  fileName: string;
  headerTitle?: string;
  html?: string;
  disabled?: boolean;
};

const escapeHtml = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export function ExportarPDFButton({ data, fileName, headerTitle = "Informe", html, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!html) return;
    setLoading(true);

    const docHtml = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${headerTitle}</title>
  <style>
    :root { --fg:#0a0a0a; --muted:#666; }
    html,body{ margin:0; padding:0; background:#fff; color:var(--fg);
      font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial; }
    .wrap{ padding:32px 36px; }
    h1,h2,h3{ line-height:1.25; margin: 0.75em 0 0.35em; }
    h1{ font-size:24px; } h2{ font-size:18px; } h3{ font-size:16px; }
    p{ margin: 0.5em 0; }
    ul,ol{ margin: 0.5em 0 0.5em 1.25em; }
    table{ border-collapse: collapse; width:100%; margin:12px 0; }
    th,td{ border:1px solid #e5e5e5; padding:6px 8px; vertical-align: top; }
    a{ color:#0b57d0; text-decoration: underline; }
    .meta{ color:var(--muted); font-size:12px; margin-top:4px; }
    .hr{ height:1px; background:#e5e5e5; margin:18px 0; }
    .section{ margin: 14px 0; }
    table, tr, td, th { page-break-inside: avoid; }
    h1, h2, h3, p { page-break-after: avoid; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(data?.titulo ?? "Actividad")}</h1>
    <div class="meta">
      <div><strong>Asignatura:</strong> ${escapeHtml(data?.asignatura ?? "—")}</div>
      <div><strong>Fecha:</strong> ${new Date(data?.fechaISO ?? Date.now()).toLocaleString("es-ES")}</div>
      <div><strong>Umbral CE:</strong> ${Number(data?.umbral ?? 0)}%</div>
    </div>

    <div class="hr"></div>

    <div class="section">
      <h2>Descripción</h2>
      ${html}
    </div>

    ${Array.isArray(data?.ces) && data.ces.length ? `
      <div class="section">
        <h2>CE detectados (${data.ces.length})</h2>
        <table>
          <thead><tr><th>CE</th><th>Descripción</th><th>Coincidencia</th></tr></thead>
          <tbody>
            ${data.ces.map((r:any)=>`
              <tr>
                <td><strong>${escapeHtml(r.codigo ?? "")}</strong></td>
                <td>${escapeHtml(r.texto || r.descripcion || "")}</td>
                <td>${Math.round((r.similitud ?? 0) * 100)}%</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}

  </div>
</body>
</html>`.trim();

    try {
      const res = await window.electronAPI.exportarPDFDesdeHTML(docHtml, fileName);
      if (!res?.ok) throw new Error(res?.error || "Fallo al exportar PDF");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={disabled || !html || loading}>
      <FileDown className="w-4 h-4 mr-2" />
      {loading ? "Exportando…" : "Exportar PDF"}
    </Button>
  );
}
