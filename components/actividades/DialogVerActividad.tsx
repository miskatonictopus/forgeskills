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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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
      setCesDetectados([]);
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
    if (r.reason === "high_sim") return <Badge variant="secondary">Alta similitud</Badge>;
    if (r.reason === "lang_rule") return <Badge variant="secondary">Lenguajes</Badge>;
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
      const muestras = r.evidencias.slice(0, 2).map((e) => `“${e}”`).join("  ·  ");
      base += ` Evidencias: ${muestras}.`;
    }
    return base;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[95vw] max-w-[95vw] sm:max-w-[1100px] lg:max-w-[1200px]
          max-h-[90vh] overflow-y-auto
        "
      >
        {/* CABECERA STICKY */}
        <div className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
          <div className="px-6 pt-3 pb-4">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Actividad
            </p>

            <DialogHeader className="flex flex-row items-center gap-6">
              <DialogTitle className="text-3xl lowercase">{actividad.nombre}</DialogTitle>

              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4" />
                <span>{new Date(actividad.fecha).toLocaleDateString("es-ES")}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <strong>Asignatura:</strong>
                <span className="uppercase">
                  {asignaturaNombre || actividad.asignaturaId}
                </span>
              </div>
            </DialogHeader>
          </div>
        </div>

        {/* CONTENIDO */}
        <div className="px-6 py-4 space-y-4 text-sm text-muted-foreground">
          {actividad.descripcion && (
            <section>
              <p className="font-semibold text-white mb-1">Descripción:</p>
              <p className="whitespace-pre-wrap mb-3">{actividad.descripcion}</p>
              <Button onClick={handleAnalizar} disabled={loading}>
                <Bot className="w-4 h-4 mr-2" />
                {loading ? "Analizando..." : "Analizar descripción"}
              </Button>
            </section>
          )}

          {cesDetectados.length > 0 && (
            <section className="mt-6">
              <p className="font-semibold text-white mb-2">CE detectados</p>

              <Table className="w-full table-auto">
                {/* Columnas: ajusta si quieres otros porcentajes */}
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "32%" }} />
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

                        {/* Descripción: clamp 2 líneas */}
                        <TableCell className="align-top pr-4">
                          <p
                            className="text-sm text-zinc-200 line-clamp-2 break-words"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {ce.descripcion}
                          </p>
                        </TableCell>

                        {/* Coincidencia: asegurar ancho y que la barra siempre se vea */}
                        <TableCell className="align-top">
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
                          <div className="mt-1 min-w-[140px]">
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
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

