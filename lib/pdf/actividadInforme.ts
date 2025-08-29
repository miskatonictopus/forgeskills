// /lib/pdf/actividadInforme.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ActividadInformeInput, GenerarPDFOpts } from "./pdf.types";

// Usa las dos fuentes exportadas
import { GEIST_REG_TTF_BASE64 } from "./fonts/geist-regular.base64";
import { GEIST_BOLD_TTF_BASE64 } from "./fonts/geist-bold.base64";

function registerGeist(doc: jsPDF) {
  doc.addFileToVFS("Geist-Regular.ttf", GEIST_REG_TTF_BASE64);
  doc.addFileToVFS("Geist-Bold.ttf", GEIST_BOLD_TTF_BASE64);
  doc.addFont("Geist-Regular.ttf", "Geist", "normal");
  doc.addFont("Geist-Bold.ttf", "Geist", "bold");
  doc.setFont("Geist", "normal");
}

const fmtFechaES = (iso?: string) =>
  new Date(iso ?? Date.now()).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// helper de altura de línea
const lh = (size: number) => size * 1.2;

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
  const M = { left: 56, right: 56, top: 56, bottom: 56 };

  // Header/Footer reutilizable
  const drawHeaderFooter = (pageNumber: number) => {
    // Header
    doc.setFont("Geist", "bold");
    doc.setFontSize(10);
    // por si quedó charSpace activo en algún punto:
    // @ts-ignore
    doc.setCharSpace?.(0);
    doc.text(asignatura, M.left, 32);
    doc.text(fechaStr, pageWidth - M.right, 32, { align: "right" });

    // línea
    doc.setDrawColor(230);
    doc.setLineWidth(0.5);
    doc.line(M.left, 38, pageWidth - M.right, 38);

    // Footer
    const total = doc.getNumberOfPages();
    doc.setFont("Geist", "normal");
    doc.setFontSize(10);
    doc.text(`Página ${pageNumber} de ${total}`, pageWidth - M.right, pageHeight - 24, { align: "right" });
  };

  // ✅ DIBUJAR CABECERA DE LA PÁGINA 1 ANTES DE TODO
  drawHeaderFooter(1);

  // aire tras header
  let y = M.top + 16;

  // ======= TÍTULO PRINCIPAL =======
  const headerTitle = opts.headerTitle ?? "Actividad evaluativa";
  doc.setFont("Geist", "bold");
  doc.setFontSize(24);
  // tracking más estrecho
  // @ts-ignore
  doc.setCharSpace?.(-0.5);

  const h1Lines = doc.splitTextToSize(headerTitle, pageWidth - (M.left + M.right));
  doc.text(h1Lines, M.left, y);
  // avanzar usando altura proporcional al tamaño actual
  y += h1Lines.length * lh(24);

  // IMPORTANTE: resetear tracking para que no afecte al resto
  // @ts-ignore
  doc.setCharSpace?.(0);

  // ======= SUBTÍTULO (título de la actividad) =======
  doc.setFont("Geist", "bold");
  doc.setFontSize(14);
  const h2Lines = doc.splitTextToSize(titulo || "—", pageWidth - (M.left + M.right));
  doc.text(h2Lines, M.left, y);
  y += h2Lines.length * lh(14);

  // ======= Meta (umbral) =======
  doc.setFont("Geist", "normal");
  doc.setFontSize(11);
  doc.setTextColor(85);
  doc.text(`Umbral aplicado: ${umbral}%`, M.left, y);
  doc.setTextColor(17);
  y += lh(11);

  // ======= Descripción =======
  doc.setFont("Geist", "normal");
  doc.setFontSize(12);
  const descLines = doc.splitTextToSize(descripcion || "—", pageWidth - (M.left + M.right));
  doc.text(descLines, M.left, y);
  y += descLines.length * lh(12) + 8;

  // ======= Título de la tabla =======
  doc.setFont("Geist", "bold");
  doc.setFontSize(12);
  doc.text("Criterios de Evaluación incluidos", M.left, y);
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
    // pintamos header/footer en todas las páginas que toquen la tabla
    didDrawPage: (hook) => {
      drawHeaderFooter(hook.pageNumber);
    },
    margin: { left: M.left, right: M.right, top: M.top, bottom: M.bottom },
  });

  // repaso final para asegurar la cabecera en la última página
  drawHeaderFooter(doc.getNumberOfPages());

  return doc.output("arraybuffer");
}
