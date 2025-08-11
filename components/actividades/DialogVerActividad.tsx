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
import { ExportarPDFButton } from "@/components/ExportarPDFButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


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
  // ----- state / refs (todos arriba) -----
  const [cesDetectados, setCesDetectados] = useState<CEDetectado[]>([]);
  const [loading, setLoading] = useState(false);

  const [fuenteAnalisis, setFuenteAnalisis] =
    useState<"snapshot" | "fresh" | "none">("none");
  const [analizadaFecha, setAnalizadaFecha] = useState<string | null>(null);
  const [analizadaLocal, setAnalizadaLocal] = useState(false);

  const [umbral, setUmbral] = useState<number>(0);
  const [filtroRazon, setFiltroRazon] =
    useState<"all" | "evidence" | "high_sim" | "lang_rule">("all");
  const [expandJusti, setExpandJusti] = useState<Record<string, boolean>>({});

  const contentRef = useRef<HTMLDivElement | null>(null);
  const ceAnchorRef = useRef<HTMLDivElement | null>(null);
  const [showTop, setShowTop] = useState(false);

  const [showUnsaved, setShowUnsaved] = useState(false);

const tieneCambiosSinGuardar = () =>
  fuenteAnalisis === "fresh" && cesDetectados.length > 0;

  const closeWithoutSave = () => {
    setShowUnsaved(false);
    onOpenChange(false);
  };
  
  const saveAndClose = async () => {
    await handleGuardarAnalisis(); // tu función existente
    setShowUnsaved(false);
    onOpenChange(false);
  };

  // ----- scroll -----
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 240);
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  // ----- cargar snapshot SIEMPRE al abrir (si existe) -----
  useEffect(() => {
    if (!open || !actividad) {
      setFuenteAnalisis("none");
      setAnalizadaFecha(null);
      setAnalizadaLocal(false);
      setCesDetectados([]);
      return;
    }

    let cancelled = false;
    const currentId = actividad.id;

    (async () => {
      try {
        const res = await window.electronAPI.leerAnalisisActividad(currentId);
        const hayCE = Array.isArray(res?.ces) && res.ces.length > 0;

        if (cancelled || actividad.id !== currentId) return;

        if (hayCE) {
          setUmbral(res.umbral ?? 0);
          setCesDetectados(res.ces);
          setAnalizadaFecha(res.fecha ?? null);
          setFuenteAnalisis("snapshot");
          setAnalizadaLocal(true);
        } else {
          setFuenteAnalisis("none");
          setAnalizadaFecha(null);
          setAnalizadaLocal(false);
          setCesDetectados([]);
        }
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setFuenteAnalisis("none");
        setAnalizadaFecha(null);
        setAnalizadaLocal(false);
        setCesDetectados([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, actividad]);

  // ----- derivados -----
  const cesFiltrados = useMemo(
    () =>
      cesDetectados
        .filter((ce) => ce.puntuacion * 100 >= umbral)
        .filter((ce) =>
          filtroRazon === "all"
            ? true
            : (ce.reason ?? "evidence") === filtroRazon
        )
        .sort((a, b) => b.puntuacion - a.puntuacion),
    [cesDetectados, umbral, filtroRazon]
  );

  const pdfData = useMemo(() => {
    if (!actividad) return null;
    return {
      titulo: actividad.nombre ?? "Actividad",
      fechaISO: actividad.fecha ?? new Date().toISOString(),
      asignatura: asignaturaNombre ?? actividad.asignaturaId ?? "—",
      descripcion: actividad.descripcion ?? "",
      umbral,
      ces: cesDetectados.map((ce) => ({
        codigo: ce.codigo,
        texto: ce.descripcion,
        similitud: ce.puntuacion,
      })),
    };
  }, [actividad, asignaturaNombre, umbral, cesDetectados]);

  const suggestedFileName = useMemo(() => {
    const base = (actividad?.nombre || "Informe_actividad")
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]+/g, "");
    return `Informe_${base}.pdf`;
  }, [actividad?.nombre]);

  const totalCE = cesDetectados.length;
  const visiblesCE = cesFiltrados.length;
  const pctCE = totalCE ? Math.round((visiblesCE / totalCE) * 100) : 0;

  // ----- acciones -----
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
        setFuenteAnalisis("fresh");
        setAnalizadaLocal(true); // hay resultado en pantalla (no guardado)
        toast.success("CE detectados con éxito.");
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && tieneCambiosSinGuardar()) {
      setShowUnsaved(true);      // abre el AlertDialog
      return;                    // NO cierres todavía
    }
    onOpenChange(nextOpen);      // cierra/abre normalmente
  };
  
  const blockCloseIfUnsaved = (e: Event) => {
    if (tieneCambiosSinGuardar()) {
      e.preventDefault();        // cancela el cierre por Esc / click fuera
      setShowUnsaved(true);
    }
  };

  const InfiniteSpinner = ({
    size = 56,
    className = "",
  }: {
    size?: number;
    className?: string;
  }) => (
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
        strokeDasharray="205.27 51.31"
        style={{ transform: "scale(0.8)", transformOrigin: "50px 50px" }}
      >
        <animate
          attributeName="stroke-dashoffset"
          dur="2s"
          keyTimes="0;1"
          values="0;256.59"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );

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
      const muestras = r.evidencias.slice(0, 2).map((e) => `“${e}”`).join("  ·  ");
      base += ` Evidencias: ${muestras}.`;
    }
    return base;
  };

  // ----- corte final (después de todos los hooks) -----
  if (!actividad) return null;

  const estadoBackend = (actividad as any)?.estado ?? "borrador";
  const mostrarAnalizada = analizadaLocal || estadoBackend === "analizada";

  const handleGuardarAnalisis = async () => {
    if (!actividad) return;
    try {
      // guarda SOLO los CE que pasan el umbral actual
      const cesParaGuardar = cesDetectados
        .filter((ce) => ce.puntuacion * 100 >= umbral)
        .map(({ codigo, puntuacion, reason, evidencias }) => ({
          codigo,
          puntuacion,
          reason,
          evidencias,
        }));
  
      const res = await window.electronAPI.guardarAnalisisActividad(
        actividad.id,
        umbral,
        cesParaGuardar
      );
  
      if (res?.ok) {
        const now = new Date().toISOString();
        setFuenteAnalisis("snapshot");
        setAnalizadaFecha(now);
        toast.success("Análisis guardado.");
  
        // 🔔 avisa a la lista para refrescar estado
        window.dispatchEvent(
          new CustomEvent("actividad:analizada", { detail: { actividadId: actividad.id } })
        );
      } else {
        toast.error("No se pudo guardar el análisis.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar el análisis.");
    }
  };
  

  // ----- render -----
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
  <DialogContent
    ref={contentRef}
    onEscapeKeyDown={blockCloseIfUnsaved}
    onPointerDownOutside={blockCloseIfUnsaved}
    className="w-[95vw] max-w-[95vw] sm:max-w-[1100px] lg:max-w-[1200px] max-h-[90vh] overflow-y-auto p-0 [&_[aria-label='Close']]:hidden"
  >
        <div className="relative">
          {/* HEADER */}
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
                <DialogTitle className="text-3xl lowercase">
                  {actividad.nombre}
                </DialogTitle>

                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="w-4 h-4" />
                  <span>{new Date(actividad.fecha).toLocaleDateString("es-ES")}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <strong>Asignatura:</strong>
                  <span className="uppercase">{asignaturaNombre || actividad.asignaturaId}</span>
                </div>

                <div className="flex items-center gap-2">
                  {mostrarAnalizada && (
                    <Badge variant="secondary" className="gap-1">Analizada</Badge>
                  )}
                  {mostrarAnalizada && analizadaFecha && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(analizadaFecha).toLocaleString("es-ES")}
                    </span>
                  )}
                </div>
              </DialogHeader>
            </div>
          </div>

          {/* CONTENT */}
          <div className="px-6 py-4 pb-28 space-y-4 text-sm text-muted-foreground">
            {actividad.descripcion && (
              <section>
                <p className="font-semibold text-white mb-1">Descripción:</p>
                <p className="whitespace-pre-wrap mb-3">{actividad.descripcion}</p>
              </section>
            )}

            <div ref={ceAnchorRef} className="scroll-mt-24" />

            {cesFiltrados.length > 0 && (
              <section className="mt-6">
                <p className="font-semibold text-white mb-2">
                  CE detectados{" "}
                  <span className="text-muted-foreground font-normal">
                    ({cesFiltrados.length} / {cesDetectados.length})
                  </span>
                </p>

                {fuenteAnalisis === "snapshot" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando análisis guardado (umbral {umbral}%). Puedes “Re-analizar” para actualizar.
                  </p>
                )}
                {fuenteAnalisis === "fresh" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando resultado reciente sin guardar. Pulsa “Guardar análisis” para persistir.
                  </p>
                )}

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
                      const isLong = why.length > 220;

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
                              className={cn("text-xs whitespace-pre-wrap break-words", !expanded && "line-clamp-3")}
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

            {showTop && (
              <div className="sticky bottom-28 flex justify-end pr-6">
                <Button
                  size="sm"
                  variant="secondary"
                  className="shadow-md"
                  onClick={() => contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                >
                  <ArrowUp className="w-4 h-4 mr-1" />
                  Arriba
                </Button>
              </div>
            )}
          </div>

          {/* FOOTER */}
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
                <ExportarPDFButton
                  data={pdfData as any}
                  headerTitle="Informe de actividad"
                  fileName={suggestedFileName}
                  disabled={!pdfData || cesDetectados.length === 0}
                />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUmbral(0);
                    setFiltroRazon("all");
                    setCesDetectados([]);
                    setFuenteAnalisis("none");
                    setAnalizadaLocal(false);
                  }}
                >
                  Limpiar
                </Button>

                {cesDetectados.length > 0 && fuenteAnalisis !== "snapshot" && (
  <Button size="sm" onClick={handleGuardarAnalisis} disabled={loading}>
    Guardar análisis
  </Button>
)}

                {mostrarAnalizada ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAnalizar}
                    disabled={loading}
                    title={fuenteAnalisis === "snapshot" ? "Ver análisis guardado (ya cargado)" : "Re-analizar"}
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                    {loading ? "Analizando..." : "Re-analizar"}
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleAnalizar} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                    {loading ? "Analizando..." : "Analizar descripción"}
                  </Button>
                )}
              </div>
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>

          {/* OVERLAY */}
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
      <AlertDialog open={showUnsaved} onOpenChange={setShowUnsaved}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Guardar antes de salir?</AlertDialogTitle>
      <AlertDialogDescription>
        Hay un análisis reciente sin guardar. Puedes guardarlo para actualizar el estado de la actividad a <strong>Analizada</strong>.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <Button variant="outline" onClick={closeWithoutSave}>
        Salir sin guardar
      </Button>
      <AlertDialogAction onClick={saveAndClose}>
        Guardar y salir
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
    </Dialog>
  );
}
