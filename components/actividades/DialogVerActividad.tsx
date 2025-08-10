"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Bot } from "lucide-react";
import { Actividad } from "@/store/actividadesPorCurso";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actividad: Actividad | null;
  asignaturaNombre?: string;
};

type CEDetectado = {
  codigo: string;
  descripcion: string;
  puntuacion: number; // 0..1
  reason?: "evidence" | "high_sim" | "lang_rule";
  evidencias?: string[];
};

export function DialogVerActividad({
  open,
  onOpenChange,
  actividad,
  asignaturaNombre,
}: Props) {
  const [cesDetectados, setCesDetectados] = useState<CEDetectado[]>([]);
  const [loading, setLoading] = useState(false);

  if (!actividad) return null;

  const handleAnalizar = async () => {
    if (!actividad?.descripcion) {
      toast.error("La actividad no tiene descripción.");
      return;
    }
    try {
      setLoading(true);
      setCesDetectados([]); // limpiar anteriores
      const ceDetectados = (await window.electronAPI.analizarDescripcion(
        actividad.id
      )) as CEDetectado[];
      if (!ceDetectados || ceDetectados.length === 0) {
        toast.warning("No se han detectado CE relevantes.");
      } else {
        setCesDetectados(ceDetectados);
        toast.success("CE detectados con éxito.");
      }
    } catch (err) {
      toast.error("Error al analizar la descripción.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const badgeFor = (r: CEDetectado) => {
    if (r.reason === "high_sim")
      return <Badge variant="secondary">Alta similitud</Badge>;
    if (r.reason === "lang_rule")
      return <Badge variant="secondary">Lenguajes</Badge>;
    return <Badge>Con evidencias</Badge>;
  };

  const makeWhy = (r: CEDetectado) => {
    const pct = `${(r.puntuacion * 100).toFixed(1)}%`;
    let base =
      r.reason === "high_sim"
        ? `Coincidencia semántica alta (${pct}) entre la descripción y el criterio.`
        : r.reason === "lang_rule"
        ? `Menciones claras a lenguajes/tecnologías del cliente que vinculan con el criterio (${pct}).`
        : `Alineación de acción y objetos del criterio detectada en el enunciado (${pct}).`;

    if (r.evidencias?.length) {
      const muestras = r.evidencias
        .slice(0, 2)
        .map((e) => `“${e}”`)
        .join("  ·  ");
      base += ` Evidencias: ${muestras}.`;
    }
    return base;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
    w-[95vw]           
    max-w-[95vw]
    sm:max-w-[1100px]       
    lg:max-w-[1200px]
    max-h-[90vh]
    overflow-y-auto
  "
      >
        <DialogHeader>
          <DialogTitle className="text-3xl">{actividad.nombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            <CalendarDays className="inline w-4 h-4 mr-1" />
            {new Date(actividad.fecha).toLocaleDateString("es-ES")}
          </p>

          <p>
            <strong>Asignatura:</strong>{" "}
            <span className="uppercase">
              {asignaturaNombre || actividad.asignaturaId}
            </span>
          </p>

          {actividad.descripcion && (
            <div className="mt-4">
              <p className="font-semibold text-white mb-1">Descripción:</p>
              <p className="whitespace-pre-wrap mb-3">
                {actividad.descripcion}
              </p>

              <Button onClick={handleAnalizar} disabled={loading}>
                <Bot className="w-4 h-4 mr-2" />
                {loading ? "Analizando..." : "Analizar descripción"}
              </Button>
            </div>
          )}

          {cesDetectados.length > 0 && (
            <div className="mt-6">
              <p className="font-semibold text-white mb-2">CE detectados</p>
              <Table className="w-full table-auto">
              <colgroup>
  <col style={{ width: "8%" }} />   {/* CE */}
  <col style={{ width: "35%" }} />  {/* Descripción */}
  <col style={{ width: "17%" }} />  {/* Coincidencia */}
  <col style={{ width: "12%" }} />  {/* Razón */}
  <col style={{ width: "28%" }} />  {/* Justificación */}
</colgroup>

  <TableHeader>
    <TableRow>
      <TableHead>CE</TableHead>
      <TableHead>Descripción</TableHead>
      <TableHead>Coincidencia</TableHead>
      <TableHead>Razón</TableHead>
      <TableHead>Justificación / Evidencias</TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    {cesDetectados
      .slice()
      .sort((a, b) => b.puntuacion - a.puntuacion)
      .map((ce) => (
        <TableRow key={ce.codigo}>
          <TableCell className="font-medium">{ce.codigo}</TableCell>

          {/* Descripción: 2 líneas máx, con wrap fiable */}
          <TableCell className="align-top pr-4">
            <div className="max-w-[560px] text-sm text-zinc-200 whitespace-normal break-words line-clamp-2">
              {ce.descripcion}
            </div>
          </TableCell>

          <TableCell className="w-[12%] align-top overflow-visible">
  <div className="flex items-center gap-2">
    <span
      className={cn(
        ce.puntuacion > 0.6
          ? "text-emerald-400"
          : ce.puntuacion >= 0.5
          ? "text-yellow-400"
          : "text-red-400",
        "font-semibold"
      )}
    >
      {(ce.puntuacion * 100).toFixed(1)}%
    </span>
  </div>

  {/* Ancho explícito al progress para que siempre se vea */}
  <div className="mt-1 w-[120px]">
    <Progress className="h-2" value={Math.round(ce.puntuacion * 100)} />
  </div>
</TableCell>

          <TableCell className="align-top">
            {badgeFor(ce)}
          </TableCell>

          <TableCell className="align-top">
            <div className="text-xs whitespace-pre-wrap">
              {makeWhy(ce)}
            </div>
          </TableCell>
        </TableRow>
      ))}
  </TableBody>
</Table>

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
