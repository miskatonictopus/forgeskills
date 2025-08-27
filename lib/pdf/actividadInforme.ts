// /lib/pdf/actividadInforme.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ActividadInformeInput, GenerarPDFOpts } from "./pdf.types";
import { GEIST_TTF_BASE64 } from "./fonts/geist.base64";

function registerGeist(doc: jsPDF) {
  // 1) Cargar la fuente en el VFS
  doc.addFileToVFS("Geist.ttf", GEIST_TTF_BASE64);
  // 2) Registrar familias/estilos
  doc.addFont("Geist.ttf", "Geist", "normal");
  doc.addFont("Geist.ttf", "Geist", "bold");
  // 3) Dejar por defecto Geist normal
  doc.setFont("Geist", "normal");
}

const fmtFechaES = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function generarPDFInformeActividad(
  data: ActividadInformeInput,
  opts: GenerarPDFOpts = {}
): ArrayBuffer {
  const {
    titulo = "Actividad",
    fechaISO,
    asignatura = "—",
    descripcion = "",
    umbral = 0,
    ces = [],
  } = data;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  registerGeist(doc);

  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const fechaStr   = fmtFechaES(fechaISO);

  // ---- Header / Footer en todas las páginas ----
  const drawHeaderFooter = (pageNumber: number) => {
    // Header: asignatura ← / fecha →
    doc.setFont("Geist", "bold");
    doc.setFontSize(10);
    doc.text(asignatura, 56, 32);
    doc.text(fechaStr, pageWidth - 56, 32, { align: "right" });

    // Línea bajo header (opcional)
    doc.setDrawColor(230);
    doc.setLineWidth(0.5);
    doc.line(56, 38, pageWidth - 56, 38);

    // Footer: paginación →
    const total = doc.getNumberOfPages();
    doc.setFont("Geist", "normal");
    doc.setFontSize(10);
    doc.text(
      `Página ${pageNumber} de ${total}`,
      pageWidth - 56,
      pageHeight - 24,
      { align: "right" }
    );
  };

  // ---- Contenido portada: Título + Descripción ----
  let y = 56 + 16; // un poco de aire tras el header fijo

  // 1) TÍTULO PRINCIPAL (fijo)
  const headerTitle = opts.headerTitle ?? "Actividad evaluativa";
  doc.setFont("Geist", "bold");
  doc.setFontSize(18);
  const h1Lines = doc.splitTextToSize(headerTitle, pageWidth - 112);
  doc.text(h1Lines, 56, y);
  y += h1Lines.length * 20; // altura aproximada por línea
  
  // 2) SUBTÍTULO (título de la actividad)
  doc.setFont("Geist", "bold");
  doc.setFontSize(14);
  const h2Lines = doc.splitTextToSize(titulo || "—", pageWidth - 112);
  doc.text(h2Lines, 56, y);
  y += h2Lines.length * 16;
  
  // 3) Meta opcional (umbral)
  doc.setFont("Geist", "normal");
  doc.setFontSize(11);
  doc.setTextColor(85);
  doc.text(`Umbral aplicado: ${umbral}%`, 56, y);
  doc.setTextColor(17);
  y += 18;
  
  // 4) Descripción (texto plano, no HTML)
  doc.setFontSize(12);
  const descLines = doc.splitTextToSize(descripcion || "—", pageWidth - 112);
  doc.text(descLines, 56, y);
  y += descLines.length * 14 + 10;
  
  // 5) Título de la tabla
  doc.setFont("Geist", "bold");
  doc.setFontSize(12);
  doc.text("Criterios de Evaluación incluidos", 56, y);
  doc.setFont("Geist", "normal");

  // Título de la tabla
  doc.setFont("Geist", "bold");
  doc.setFontSize(12);
  doc.text("Criterios de Evaluación incluidos", 56, y);
  doc.setFont("Geist", "normal");

  // ---- Tabla CE ----
  const filtrados = (ces ?? [])
    .map((ce) => ({
      ...ce,
      similitudPct: Math.round((ce.similitud ?? 0) * 100),
    }))
    .filter((ce) => ce.similitudPct >= umbral);

  autoTable(doc, {
    startY: y + 8,
    styles: {
      font: "Geist",
      fontStyle: "normal",
      fontSize: 10,
      cellPadding: 6,
      overflow: "linebreak",
    },
    headStyles: {
      font: "Geist",
      fontStyle: "bold",
    },
    head: [["Código CE", "RA", "Descripción", "Similitud"]],
    body: filtrados.length
      ? filtrados.map((ce: any) => [
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
    didDrawPage: (dataHook) => {
      drawHeaderFooter(dataHook.pageNumber);
    },
    margin: { left: 56, right: 56, top: 56, bottom: 56 },
  });

  // Asegura que la última página también tenga header/footer consistentes
  drawHeaderFooter(doc.getNumberOfPages());

  return doc.output("arraybuffer");
}
