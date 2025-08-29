// lib/pdf/generarInformeHTML.ts
import type { ActividadInformeInput, GenerarPDFOpts } from "./pdf.types";
import { buildActividadHTML } from "./actividadInformeHTML";
import { renderHTMLtoPDF } from "./renderHTMLtoPDF";

export async function generarPDFInformeActividad_HTML(
  data: ActividadInformeInput,
  opts: GenerarPDFOpts = {}
): Promise<Buffer> {
  const html = buildActividadHTML(data, { headerTitle: opts.headerTitle ?? "Actividad evaluativa" });
  const pdfBuffer = await renderHTMLtoPDF(html);
  return pdfBuffer;
}