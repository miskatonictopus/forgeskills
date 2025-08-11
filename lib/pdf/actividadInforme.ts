// /lib/pdf/actividadInforme.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ActividadInformeInput, GenerarPDFOpts } from "./pdf.types";

export function generarPDFInformeActividad(
  data: ActividadInformeInput,
  opts: GenerarPDFOpts = {}
): ArrayBuffer {
  const {
    titulo,
    fechaISO,
    asignatura,
    descripcion = "",
    umbral,
    ces,
  } = data;

  const headerTitle = opts.headerTitle ?? "Informe de actividad";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const filtrados = (ces ?? [])
    .filter((ce) => Math.round((ce.similitud ?? 0) * 100) >= umbral)
    .map((ce) => ({
      ...ce,
      similitudPct: Math.round((ce.similitud ?? 0) * 100),
    }));

  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(headerTitle, pageWidth / 2, y, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  y += 34;
  doc.text(`Título: ${titulo}`, 56, y);
  y += 18;
  doc.text(`Fecha: ${new Date(fechaISO).toLocaleDateString()}`, 56, y);
  y += 18;
  doc.text(`Asignatura: ${asignatura}`, 56, y);
  y += 18;
  doc.text(`Umbral aplicado: ${umbral}%`, 56, y);

  // Descripción
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.text("Descripción", 56, y);
  doc.setFont("helvetica", "normal");
  y += 12;
  const descLines = doc.splitTextToSize(descripcion || "—", pageWidth - 112);
  doc.text(descLines, 56, y);
  y += descLines.length * 14 + 10;

  // Tabla CE
  doc.setFont("helvetica", "bold");
  doc.text("Criterios de Evaluación incluidos", 56, y);
  doc.setFont("helvetica", "normal");

  autoTable(doc, {
    startY: y + 8,
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6, overflow: "linebreak" },
    head: [["Código CE", "RA", "Descripción", "Similitud"]],
    body: filtrados.length
      ? filtrados.map((ce) => [
          ce.codigo || "—",
          ce.ra || "—",
          ce.texto || "—",
          `${ce.similitudPct}%`,
        ])
      : [["—", "—", "No hay CE que cumplan el umbral", "—"]],
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 70 },
      2: { cellWidth: 260 },
      3: { cellWidth: 70, halign: "right" },
    },
    didDrawPage: () => {
      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`${headerTitle} · ${titulo}`, 56, 32);
      // Footer
      const page = doc.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.text(`Página ${page}`, pageWidth - 56, pageHeight - 24, { align: "right" });
    },
    margin: { left: 56, right: 56, top: 56, bottom: 56 },
  });

  return doc.output("arraybuffer");
}
