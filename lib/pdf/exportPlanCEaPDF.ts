// lib/pdf/exportPlanCEaPDF.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Row = {
  ceCodigo: string;
  raCodigo: string;
  dificultad: number; // 1..5
  minutos: number;
  justificacion: string;
};

export function exportPlanCEaPDF(rows: Row[], opts?: { titulo?: string; fileName?: string }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const titulo = opts?.titulo ?? "Planificación de CE";
  const fileName = opts?.fileName ?? "plan_ce.pdf";

  // Título
  doc.setFontSize(16);
  doc.text(titulo, 56, 56);

  // Tabla
  autoTable(doc, {
    startY: 80,
    head: [["CE", "RA", "Nivel", "Minutos", "Justificación"]],
    body: rows.map((r) => [
      r.ceCodigo,
      r.raCodigo,
      `D${Math.min(5, Math.max(1, Math.round(r.dificultad)))}`,
      String(r.minutos),
      r.justificacion,
    ]),
    styles: { fontSize: 10, cellPadding: 6, valign: "top" },
    headStyles: { halign: "left" },
    columnStyles: {
      0: { cellWidth: 70 },  // CE
      1: { cellWidth: 50 },  // RA
      2: { cellWidth: 60 },  // Nivel
      3: { cellWidth: 60 },  // Minutos
      4: { cellWidth: 300 }, // Justificación
    },
    didDrawPage: (data) => {
      // Footer sencillo
      const page = String(doc.getCurrentPageInfo().pageNumber);
      doc.setFontSize(9);
      doc.text(`Página ${page}`, doc.internal.pageSize.getWidth() - 56, doc.internal.pageSize.getHeight() - 32, {
        align: "right",
      });
    },
  });

  // 👉 Opción A: descargar directamente en navegador
  doc.save(fileName);

  // 👉 Opción B (si usas Electron y ya tienes IPC para guardar en Documents/SkillForgePDF):
  // const bytes = doc.output("arraybuffer");
  // const buf = Buffer.from(bytes);
  // await window.electronAPI.guardarPDF(buf, fileName);
}
