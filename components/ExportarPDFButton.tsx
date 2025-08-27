// ExportarPDFButton.tsx
"use client";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useState } from "react";

type Props = { data: any; fileName: string; headerTitle?: string; html?: string; disabled?: boolean; };

const escapeHtml = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function ExportarPDFButton({ data, fileName, headerTitle = "Informe", html, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!html) return;
    setLoading(true);
    try {
      const docHtml = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><title>${escapeHtml(headerTitle)}</title></head>
<body>
  <section class="wrap" style="padding:32px 36px;">
    <h1>${escapeHtml(data?.titulo ?? "Actividad")}</h1>
    <p class="meta">
      <strong>Asignatura:</strong> ${escapeHtml(data?.asignatura ?? "—")}
      &nbsp;·&nbsp; <strong>Fecha:</strong> ${new Date(data?.fechaISO ?? Date.now()).toLocaleDateString("es-ES")}
      &nbsp;·&nbsp; <strong>Umbral CE:</strong> ${Number(data?.umbral ?? 0)}%
    </p>
    <hr/>
    <h2>Descripción</h2>
    ${html}
    ${
      Array.isArray(data?.ces) && data.ces.length
        ? `<h2>CE detectados (${data.ces.length})</h2>
           <table>
             <thead><tr><th>CE</th><th>Descripción</th><th>Coincidencia</th></tr></thead>
             <tbody>
               ${data.ces.map((r:any)=>`
                 <tr>
                   <td><strong>${escapeHtml(r.codigo ?? "")}</strong></td>
                   <td>${escapeHtml(r.texto || r.descripcion || "")}</td>
                   <td style="text-align:right">${Math.round((r.similitud ?? 0) * 100)}%</td>
                 </tr>`).join("")}
             </tbody>
           </table>`
        : ""
    }
  </section>
</body>
</html>`.trim();

      const res = await (window as any).electronAPI.exportarPDFDesdeHTML(docHtml, fileName);
      if (!res?.ok) throw new Error(res?.error || "Fallo al exportar PDF");
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
