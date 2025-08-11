// components/ExportarPDFButton.tsx
"use client";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { generarPDFInformeActividad } from "@/lib/pdf/actividadInforme";
import { savePDF } from "@/lib/pdf/save";
import { ActividadInformeInput } from "@/lib/pdf/pdf.types";

type Props = {
  data: ActividadInformeInput;          // Lo que quieres imprimir
  fileName?: string;                    // opcional
  headerTitle?: string;                 // opcional
  disabled?: boolean;
};

export function ExportarPDFButton({ data, fileName, headerTitle, disabled }: Props) {
  const onClick = async () => {
    const pdf = generarPDFInformeActividad(data, { headerTitle });
    const sugerido = fileName ?? `Informe_${data.titulo.replace(/\s+/g, "_")}.pdf`;
    await savePDF(pdf, sugerido);
  };

  return (
    <Button variant="outline" onClick={onClick} disabled={disabled}>
      <FileDown className="mr-2 h-4 w-4" />
      Exportar PDF
    </Button>
  );
}
