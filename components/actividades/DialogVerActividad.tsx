"use client";

import { useState, useMemo, useRef, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { CalendarDays, Bot, X, Loader2, ArrowUp } from "lucide-react";
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

  

  // Footer controls
  const [umbral, setUmbral] = useState<number>(0);
  const [filtroRazon, setFiltroRazon] = useState<
    "all" | "evidence" | "high_sim" | "lang_rule"
  >("all");

  

  // Toggle "ver más" por CE (key = codigo)
  const [expandJusti, setExpandJusti] = useState<Record<string, boolean>>({});
  

  // Scroll refs
  const contentRef = useRef<HTMLDivElement | null>(null); // DialogContent
  const ceAnchorRef = useRef<HTMLDivElement | null>(null); // ancla a resultados

  // Mostrar botón "Arriba" cuando scrollea
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 240);
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

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

  const totalCE = cesDetectados.length;
const visiblesCE = cesFiltrados.length;
const pctCE = totalCE ? Math.round((visiblesCE / totalCE) * 100) : 0;

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

        // Auto-scroll a resultados (compensa header sticky con scroll-mt)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ceAnchorRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          });
        });
      }
    } catch (err) {
      toast.error("Error al analizar la descripción.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  function InfiniteSpinner({
    size = 56,
    className = "",
  }: { size?: number; className?: string }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <title>Loading…</title>
        <path
          d="M24.3 30C11.4 30 5 43.3 5 50s6.4 20 19.3 20c19.3 0 32.1-40 51.4-40C88.6 30 95 43.3 95 50s-6.4 20-19.3 20C56.4 70 43.6 30 24.3 30z"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="205.271142578125 51.317785644531256"
          style={{ transform: "scale(0.8)", transformOrigin: "50px 50px" }}
        >
          <animate
            attributeName="stroke-dashoffset"
            dur="2s"
            keyTimes="0;1"
            values="0;256.58892822265625"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    );
  }

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
        ref={contentRef}
        className="
          w-[95vw] max-w-[95vw] sm:max-w-[1100px] lg:max-w-[1200px]
          max-h-[90vh] overflow-y-auto
          p-0
          [&_[aria-label='Close']]:hidden
        "
      >
        {/* Wrapper RELATIVE para overlay centrado */}
        <div className="relative">
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

          {/* CONTENT (espacio para el footer) */}
          <div className="px-6 py-4 pb-28 space-y-4 text-sm text-muted-foreground">
            {actividad.descripcion && (
              <section>
                <p className="font-semibold text-white mb-1">Descripción:</p>
                <p className="whitespace-pre-wrap mb-3">{actividad.descripcion}</p>
              </section>
            )}

            {/* ANCLA para auto-scroll (compensa header sticky) */}
            <div ref={ceAnchorRef} className="scroll-mt-24" />

            {cesFiltrados.length > 0 && (
              <section className="mt-6">
                <p className="font-semibold text-white mb-2">
                  CE detectados{" "}
                  <span className="text-muted-foreground font-normal">
                    ({cesFiltrados.length} / {cesDetectados.length})
                  </span>
                </p>

                <Table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[28%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[40%]" />
                  </colgroup>

                  <TableHeader>
                    <TableRow className="[&>th]:align-top">
                      <TableHead>CE</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Coincidencia</TableHead>
                      <TableHead>Razón</TableHead>
                      <TableHead>Justificación / Evidencias</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {cesFiltrados.map((ce) => {
                      const why = makeWhy(ce);
                      const expanded = !!expandJusti[ce.codigo];
                      const isLong = why.length > 220; // umbral simple

                      return (
                        <TableRow key={ce.codigo} className="[&>td]:align-top">
                          <TableCell className="font-medium">{ce.codigo}</TableCell>

                          <TableCell className="pr-4">
                            <p
                              className="text-sm text-zinc-200 whitespace-pre-wrap break-words leading-snug"
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {ce.descripcion}
                            </p>
                          </TableCell>

                          <TableCell>
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

                          <TableCell>{badgeFor(ce)}</TableCell>

                          <TableCell>
                            <div
                              className={cn(
                                "text-xs whitespace-pre-wrap break-words",
                                !expanded && "line-clamp-3"
                              )}
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {why}
                            </div>
                            {isLong && (
                              <button
                                className="mt-1 text-xs underline text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setExpandJusti((s) => ({ ...s, [ce.codigo]: !expanded }))
                                }
                              >
                                {expanded ? "Ver menos" : "Ver más"}
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </section>
            )}

            {/* Botón flotante "Arriba" */}
            {showTop && (
              <div className="sticky bottom-28 flex justify-end pr-6">
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow-md"
                  onClick={() =>
                    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
                  }
                >
                  <ArrowUp className="w-4 h-4 mr-1" />
                  Arriba
                </Button>
              </div>
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

                {/* Contador CE (filtrados / total · %) */}
{totalCE > 0 && (
  <Badge variant="secondary" className="ml-3">
    CE <span className="tabular-nums ml-1">{visiblesCE}</span>
    <span className="mx-1 text-muted-foreground">/</span>
    <span className="tabular-nums">{totalCE}</span>
    <span className="mx-1 text-muted-foreground">·</span>
    <span className="tabular-nums">{pctCE}%</span>
  </Badge>
)}
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
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4 mr-2" />
                  )}
                  {loading ? "Analizando..." : "Analizar descripción"}
                </Button>
              </div>
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>

          {/* OVERLAY CENTRADO */}
          {loading && (
  <div className="pointer-events-none absolute inset-0 z-[1000] grid place-items-center bg-background/60 backdrop-blur-sm">
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      <InfiniteSpinner className="text-foreground/85" />
      <p className="text-xs text-muted-foreground">Analizando descripción…</p>
    </div>
  </div>
)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
