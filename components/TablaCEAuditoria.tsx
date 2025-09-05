// components/TablaCEAuditoria.tsx
"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { exportPlanCEaPDF } from "@/lib/pdf/exportPlanCEaPDF";

type Row = {
  ceCodigo: string;    // "CE3.2"
  raCodigo: string;    // "RA3"
  dificultad: number;  // 1..5
  minutos: number;     // 20..120
  justificacion: string;
};

export default function TablaCEAuditoria({ rows, titulo = "Planificación CE" }: { rows: Row[]; titulo?: string }) {
  const D = (n: number) => `D${Math.min(5, Math.max(1, Math.round(n)))}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{titulo}</h3>
        <Button
          size="sm"
          onClick={() => exportPlanCEaPDF(rows, { titulo })}
          aria-label="Exportar PDF"
        >
          Exportar PDF
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">CE</TableHead>
              <TableHead className="w-[90px]">RA</TableHead>
              <TableHead className="w-[90px]">Nivel</TableHead>
              <TableHead className="w-[100px]">Minutos</TableHead>
              <TableHead>Justificación (hover)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.ceCodigo}>
                <TableCell className="font-mono">{r.ceCodigo}</TableCell>
                <TableCell className="font-mono">{r.raCodigo}</TableCell>
                <TableCell>{D(r.dificultad)}</TableCell>
                <TableCell>{r.minutos}</TableCell>
                <TableCell className="max-w-[560px]">
                  <Tooltip>
                    <TooltipTrigger className="truncate text-muted-foreground text-left max-w-[560px]">
                      {r.justificacion}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[420px] leading-snug">
                      {r.justificacion}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Nota: en pantalla mostramos tooltip; en PDF exportamos texto completo. */}
    </div>
  );
}
