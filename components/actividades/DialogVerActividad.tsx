"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { CalendarDays, Bot, X } from "lucide-react";
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

  // Controles del footer
  const [umbral, setUmbral] = useState<number>(0); // 0..100
  const [filtroRazon, setFiltroRazon] = useState<
    "all" | "evidence" | "high_sim" | "lang_rule"
  >("all");

  const cesFiltrados = useMemo(
    () =>
      cesDetectados
        .filter((ce) => ce.puntuacion * 100 >= umbral)
        .filter((ce) =>
          filtroRazon === "all" ? true : (ce.reason ?? "evidence") === filtroRazon
        )
        .sort((a, b) => b.puntuacion - a.puntuacion),
    [cesDetectados, umbral, filtroRazon]
  );

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
          p-0
          [&_[aria-label='Close']]:hidden
        "
      >
        {/* HEADER STICKY */}
        <div className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
          <div className="relative px-6 pt-3 pb-4 pr-12">
            <DialogClose asChild>
              <button
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-[999] rounded-md p-2 hover:bg-muted focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </DialogClose>

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

        {/* CONTENT (deja espacio para el footer) */}
        <div className="px-6 py-4 pb-28 space-y-4 text-sm text-muted-foreground">
          {actividad.descripcion && (
            <section>
              <p className="font-semibold text-white mb-1">Descripción:</p>
              <p className="whitespace-pre-wrap mb-3">{actividad.descripcion}</p>
              {/* Botón aquí también si quieres redundancia */}

            </section>
          )}

          {cesFiltrados.length > 0 && (
            <section className="mt-6">
              <p className="font-semibold text-white mb-2">CE detectados</p>

              <Table className="w-full table-fixed">
              <colgroup>
    <col className="w-[8%]" />
    <col className="w-[28%]" />
    <col className="w-[12%]" />
    <col className="w-[12%]" />
    <col className="w-[20%]" />
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
                  {cesFiltrados.map((ce) => (
                    <TableRow key={ce.codigo}>
                      <TableCell className="font-medium align-top">{ce.codigo}</TableCell>

                      <TableCell className="align-top pr-4">
  <p
    className="text-sm text-zinc-200 whitespace-pre-wrap break-words leading-snug"
    style={{ overflowWrap: "anywhere" }} // por si hay strings largas/URLs
  >
    {ce.descripcion}
  </p>
</TableCell>


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

                      <TableCell className="align-top">{badgeFor(ce)}</TableCell>

                      <TableCell className="align-top">
  <div
    className="text-xs whitespace-pre-wrap break-words"
    style={{ overflowWrap: "anywhere" }}
  >
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

        {/* FOOTER STICKY */}
        <div className="sticky bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
          <div className="px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-muted-foreground">Mostrar:</label>
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={filtroRazon}
                onChange={(e) => setFiltroRazon(e.target.value as any)}
              >
                <option value="all">Todos</option>
                <option value="evidence">Con evidencias</option>
                <option value="high_sim">Alta similitud</option>
                <option value="lang_rule">Lenguajes</option>
              </select>

              <label className="text-xs text-muted-foreground ml-2">Umbral:</label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={umbral}
                onChange={(e) => setUmbral(Number(e.target.value))}
                className="w-40"
              />
              <span className="text-xs tabular-nums">{umbral}%</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUmbral(0);
                  setFiltroRazon("all");
                  setCesDetectados([]);
                }}
              >
                Limpiar
              </Button>
              <Button size="sm" onClick={handleAnalizar} disabled={loading}>
                <Bot className="w-4 h-4 mr-2" />
                {loading ? "Analizando..." : "Analizar descripción"}
              </Button>
            </div>
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
