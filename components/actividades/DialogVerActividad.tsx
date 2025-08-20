"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { alumnosStore, cargarAlumnosCurso, getAlumnosDeCurso } from "@/store/alumnosStore";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { CalendarDays, Bot, X, Loader2, ArrowUp } from "lucide-react";
import { Actividad, cargarActividades, estadoUI } from "@/store/actividadesPorCurso";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import EvaluarActividad from "@/components/evaluar/EvaluarActividad";
import { useSnapshot } from "valtio";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExportarPDFButton } from "@/components/ExportarPDFButton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import DOMPurify from "isomorphic-dompurify";
import { useDefensorDeHorarios } from "@/components/horarios/useDefensorDeHorarios";

/* ---------------------- helpers ---------------------- */
const normCE = (s?: string) =>
  (s ?? "").toString().trim().toUpperCase().replace(/\s+/g, "");

const toHtml = (plain: string) =>
  `<p>${(plain ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => (p.trim().length ? p.trim().replace(/\n/g, "<br/>") : "<br/>"))
    .join("</p><p>")}</p>`;

const htmlFromDescripcion = (desc: string) => {
  const maybeHtml = /<\/?[a-z][\s\S]*>/i.test(desc) ? desc : toHtml(desc);
  return DOMPurify.sanitize(maybeHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  }).replaceAll(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
};

function RenderHTML({
  html, className = "", emptyFallback = "Sin descripción.",
}: { html?: string; className?: string; emptyFallback?: string; }) {
  if (!html || !html.trim()) return <p className="text-sm text-muted-foreground">{emptyFallback}</p>;
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  }).replaceAll(/<a\s/gi, '<a target="_blank" rel="noopener noreferrer" ');
  return (
    <article
      className={`prose prose-invert max-w-none prose-headings:mt-4 prose-p:my-2 prose-li:my-1 ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

/* ===== Badge de estado unificado ===== */
function EstadoBadgeHeader({
  estadoCanon,
  programadaPara,
  analisisFecha,
}: {
  estadoCanon?: "borrador" | "analizada" | "programada" | "pendiente_evaluar" | "evaluada" | "cerrada";
  programadaPara?: string | null;
  analisisFecha?: string | null;
}) {
  const ev = estadoCanon ?? "borrador";

  const label =
    ev === "analizada" ? "Analizada" :
    ev === "programada" ? "Programada" :
    ev === "pendiente_evaluar" ? "Pendiente de evaluar" :
    ev === "evaluada" ? "Evaluada" :
    ev === "cerrada" ? "Cerrada" :
    "Borrador";

  const cls =
    ev === "analizada" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    ev === "programada" ? "bg-sky-500/15 text-sky-400 border-sky-500/30" :
    ev === "pendiente_evaluar" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
    ev === "evaluada" ? "bg-violet-500/15 text-violet-400 border-violet-500/30" :
    ev === "cerrada" ? "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30" :
    "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";

  const fechaAux = ev === "analizada" ? analisisFecha : ev === "programada" ? programadaPara : null;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={cn("border", cls)}>{label}</Badge>
      {fechaAux && (
        <span className="text-[11px] text-muted-foreground">
          {new Date(fechaAux).toLocaleDateString("es-ES")}
        </span>
      )}
    </div>
  );
}

/* ===== Dialog ===== */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actividad: Actividad | null;
  asignaturaNombre?: string;
};

type CEDetectado = {
  codigo: string;
  descripcion?: string;
  puntuacion: number; // 0..1
  reason?: "evidence" | "high_sim" | "lang_rule";
  evidencias?: string[];
};

export function DialogVerActividad({
  open, onOpenChange, actividad, asignaturaNombre,
}: Props) {
  const [cesDetectados, setCesDetectados] = useState<CEDetectado[]>([]);
  const [loading, setLoading] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  useEffect(() => {
    if (actividad?.cursoId) {
      cargarAlumnosCurso(actividad.cursoId);
    }
  }, [actividad?.cursoId]);
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
  useEffect(() => {
    const onEvaluada = (ev: any) => {
      const id = ev?.detail?.actividadId;
      if (!id || !actividad) return;
      if (id !== actividad.id) return;
  
      const cursoId = String((actividad as any).cursoId ?? (actividad as any).curso_id ?? "");
      if (cursoId) cargarActividades(cursoId);
    };
  
    window.addEventListener("actividad:evaluada", onEvaluada);
    return () => window.removeEventListener("actividad:evaluada", onEvaluada);
  }, [actividad?.id]);
  // Defensor de horarios
  const { openDefensorDeHorarios, dialog: defensorDialog } = useDefensorDeHorarios();

  // catálogo CE
  const [ceDescByCode, setCeDescByCode] = useState<Record<string, string>>({});
  const getCeText = (r: any) => {
    const byField = (r?.descripcion || r?.texto || "").trim();
    if (byField) return byField;
    return (ceDescByCode[normCE(r?.codigo)] || "").trim();
  };

  const tieneCambiosSinGuardar = () =>
    fuenteAnalisis === "fresh" && cesDetectados.length > 0;

  const closeWithoutSave = () => { setShowUnsaved(false); onOpenChange(false); };
  const saveAndClose = async () => { await handleGuardarAnalisis(); setShowUnsaved(false); onOpenChange(false); };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && tieneCambiosSinGuardar()) { setShowUnsaved(true); return; }
    onOpenChange(nextOpen);
  };

  // scroll
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => setShowTop(el.scrollTop > 240);
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  // snapshot análisis guardado…
  useEffect(() => {
    if (!open || !actividad) {
      setFuenteAnalisis("none"); setAnalizadaFecha(null); setAnalizadaLocal(false); setCesDetectados([]); return;
    }
    let cancelled = false;
    const currentId = actividad.id;
    (async () => {
      try {
        const res = await (window.electronAPI as any).leerAnalisisActividad(currentId);
        const hayCE = Array.isArray(res?.ces) && res.ces.length > 0;
        if (cancelled || actividad.id !== currentId) return;
        if (hayCE) {
          setUmbral(res.umbral ?? 0);
          setCesDetectados((res.ces as CEDetectado[]).map(c => ({ ...c, codigo: normCE(c.codigo) })));
          setAnalizadaFecha(res.fecha ?? null);
          setFuenteAnalisis("snapshot");
          setAnalizadaLocal(true);
        } else {
          setFuenteAnalisis("none"); setAnalizadaFecha(null); setAnalizadaLocal(false); setCesDetectados([]);
        }
      } catch {
        if (cancelled) return;
        setFuenteAnalisis("none"); setAnalizadaFecha(null); setAnalizadaLocal(false); setCesDetectados([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, actividad]);

  // catálogo RA→CE
  useEffect(() => {
    (async () => {
      if (!open || !actividad?.asignaturaId) return;
      try {
        const api = window.electronAPI as any;
        let lista: Array<{ codigo: string; descripcion: string }> = [];
        if (api?.leerRADeAsignatura) {
          const ra = await api.leerRADeAsignatura(actividad.asignaturaId);
          lista = (Array.isArray(ra) ? ra : [])
            .flatMap((r: any) => r?.CE || r?.ce || [])
            .filter((x: any) => x?.codigo)
            .map((x: any) => ({ codigo: normCE(String(x.codigo)), descripcion: String(x.descripcion ?? x.texto ?? "") }));
        }
        const map: Record<string, string> = {};
        for (const it of lista) map[it.codigo] = it.descripcion;
        setCeDescByCode(map);
      } catch { setCeDescByCode({}); }
    })();
  }, [open, actividad?.asignaturaId]);

  // analizar con backend
  const handleAnalizar = async () => {
    if (!actividad?.descripcion) { toast.error("La actividad no tiene descripción."); return; }
    try {
      setLoading(true);
      setCesDetectados([]);
      const ceDetectados = (await (window.electronAPI as any).analizarDescripcion(actividad.id)) as CEDetectado[];
      if (!ceDetectados || ceDetectados.length === 0) {
        toast.warning("No se han detectado CE relevantes.");
      } else {
        setCesDetectados(ceDetectados.map(c => ({ ...c, codigo: normCE(c.codigo) })));
        setFuenteAnalisis("fresh");
        setAnalizadaLocal(true);
        toast.success("CE detectados con éxito.");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ceAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        });
      }
    } catch (err) {
      toast.error("Error al analizar la descripción."); console.error(err);
    } finally { setLoading(false); }
  };

  // guardar análisis
  const handleGuardarAnalisis = async () => {
    if (!actividad) return;
    try {
      const cesParaGuardar = cesDetectados
        .filter((ce) => ce.puntuacion * 100 >= umbral)
        .map(({ codigo, puntuacion, reason, evidencias }) => ({
          codigo,
          puntuacion,
          reason,
          evidencias,
          descripcion: ceDescByCode[normCE(codigo)] || "",
        }));

        const res = await window.electronAPI.guardarAnalisisActividad(
          actividad.id,
          umbral,
          cesParaGuardar
        );

      if (res?.ok) {
        const now = new Date().toISOString();
        setFuenteAnalisis("snapshot"); setAnalizadaFecha(now); setAnalizadaLocal(true);
        toast.success("Análisis guardado.");
        window.dispatchEvent(new CustomEvent("actividad:analizada", { detail: { actividadId: actividad.id } }));
      } else {
        toast.error("No se pudo guardar el análisis.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar el análisis.");
    }
  };

  // programar actividad
  const handleProgramar = async () => {
    if (!actividad) return;

    const cursoId = String((actividad as any).cursoId || (actividad as any).curso_id || "");
    const asignaturaId = String((actividad as any).asignaturaId || (actividad as any).asignatura_id || "");
    if (!cursoId || !asignaturaId) {
      toast.error("Faltan curso o asignatura en la actividad.");
      return;
    }

    const duracionMin = Number((actividad as any).duracionMin || 60);

    const slot = await openDefensorDeHorarios({
      cursoId,
      asignaturaId,
      duracionMin,
      stepMinutes: 15,
      initial: new Date(),
    });
    if (!slot) return;

    const startISO = new Date(slot.startISO).toISOString();

    try {
      const res = await window.electronAPI.actividadProgramar({
        actividadId: actividad.id,
        startISO,
        duracionMin,
      });

      if (res?.ok) {
        toast.success("Actividad programada correctamente ✅");
        await cargarActividades(cursoId);
        onOpenChange(false);
      } else {
        toast.error(res?.error ?? "No se pudo programar la actividad ❌");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al programar la actividad ❌");
    }
  };

  /* ====== DERIVADOS: NUNCA returns tempranos; todo null-safe ====== */
  const hasActividad = !!actividad;

  const ev = hasActividad
    ? (actividad!.estadoCanon ?? estadoUI(actividad!))
    : "borrador";

  const programadaPara =
    (actividad as any)?.programadaPara ??
    (actividad as any)?.programada_para ??
    null;

  const cesFiltrados = useMemo(
    () =>
      (!hasActividad ? [] : cesDetectados)
        .filter((ce) => ce.puntuacion * 100 >= umbral)
        .filter((ce) =>
          filtroRazon === "all" ? true : (ce.reason ?? "evidence") === filtroRazon
        )
        .sort((a, b) => b.puntuacion - a.puntuacion),
    [hasActividad, cesDetectados, umbral, filtroRazon]
  );

  const pdfData = useMemo(() => {
    if (!hasActividad) return null;
    const desc = actividad!.descripcion ?? "";
    const html = desc.trim() ? htmlFromDescripcion(desc) : "<p>Sin contenido</p>";
    return {
      titulo: actividad!.nombre ?? "Actividad",
      fechaISO: actividad!.fecha ?? new Date().toISOString(),
      asignatura: asignaturaNombre ?? actividad!.asignaturaId ?? "—",
      html,
      umbral,
      ces: cesDetectados.map((ce) => ({
        codigo: ce.codigo,
        texto: (ce.descripcion || "").trim() || "",
        descripcion: (ce.descripcion || "").trim() || "",
        similitud: ce.puntuacion ?? 0,
      })),
    };
  }, [hasActividad, actividad, asignaturaNombre, umbral, cesDetectados]);

  const suggestedFileName = useMemo(() => {
    const base = (actividad?.nombre || "Informe_actividad")
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]+/g, "");
    return `Informe_${base}.pdf`;
  }, [actividad?.nombre]);

  const totalCE = cesDetectados.length;
  const visiblesCE = cesFiltrados.length;
  const pctCE = totalCE ? Math.round((visiblesCE / totalCE) * 100) : 0;

  /* =================== RENDER =================== */
  return (
    <>
      {hasActividad && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            ref={contentRef}
            className="w-[95vw] max-w-[95vw] sm:max-w-[1100px] lg:max-w-[1200px] max-h-[90vh] overflow-y-auto p-0"
          >
            {/* HEADER */}
            <div className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur">
              <div className="relative px-6 pt-3 pb-4 pr-12">
                <DialogClose asChild>
                  <button aria-label="Cerrar" className="absolute right-3 top-3 rounded-md p-2 hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </DialogClose>

                <DialogHeader className="flex flex-row items-center gap-6">
                  <DialogTitle className="text-3xl">{actividad!.nombre}</DialogTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-4" />
                    <span>{new Date(actividad!.fecha).toLocaleDateString("es-ES")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>Asignatura:</strong>
                    <span className="uppercase">{asignaturaNombre || actividad!.asignaturaId}</span>
                  </div>

                  <EstadoBadgeHeader
                    estadoCanon={ev as any}
                    programadaPara={programadaPara}
                    analisisFecha={analizadaLocal ? analizadaFecha : actividad!.analisisFecha ?? null}
                  />
                </DialogHeader>
              </div>
            </div>

            {/* CONTENT */}
            <div className="px-6 py-4 pb-28 space-y-4 text-sm text-muted-foreground">
              {actividad!.descripcion && (
                <section>
                  <p className="font-semibold text-white mb-1">Descripción:</p>
                  <div className="rounded-md border bg-background/40 p-4">
                    <RenderHTML
                      html={
                        /<\/?[a-z][\s\S]*>/i.test(actividad!.descripcion)
                          ? actividad!.descripcion
                          : toHtml(actividad!.descripcion)
                      }
                    />
                  </div>
                </section>
              )}

              <div ref={ceAnchorRef} className="scroll-mt-24" />

              {cesFiltrados.length > 0 && (
                <section className="mt-6">
                  <p className="font-semibold text-white mb-2">
                    CE detectados{" "}
                    <span className="text-muted-foreground font-normal">
                      ({visiblesCE} / {totalCE})
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
                        const pctTxt = `${(ce.puntuacion * 100).toFixed(1)}%`;
                        const whyBase =
                          ce.reason === "high_sim"
                            ? `Coincidencia semántica alta (${pctTxt}) entre la descripción y el criterio.`
                            : ce.reason === "lang_rule"
                            ? `Menciones claras a lenguajes/tecnologías que vinculan con el criterio (${pctTxt}).`
                            : `Alineación de acción y objetos del criterio detectada en el enunciado (${pctTxt}).`;
                        const evid = ce.evidencias?.length
                          ? ` Evidencias: ${ce.evidencias.slice(0, 2).map((e) => `“${e}”`).join("  ·  ")}.`
                          : "";
                        const why = `${whyBase}${evid}`;

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
                                {getCeText(ce) || "—"}
                              </p>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    ce.puntuacion > 0.6 ? "text-emerald-400" :
                                    ce.puntuacion >= 0.5 ? "text-yellow-400" : "text-red-400",
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

                            <TableCell>
                              {ce.reason === "high_sim" ? (
                                <Badge variant="secondary">Alta similitud</Badge>
                              ) : ce.reason === "lang_rule" ? (
                                <Badge variant="secondary">Lenguajes</Badge>
                              ) : (
                                <Badge>Con evidencias</Badge>
                              )}
                            </TableCell>

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

            {/* FOOTER acciones */}
            <div className="sticky bottom-0 z-50 border-t bg-background/85 backdrop-blur px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  html={pdfData?.html}
                  disabled={!pdfData}
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

                {analizadaLocal || (actividad as any)?.estado === "analizada" ? (
                  <Button size="sm" variant="secondary" onClick={handleAnalizar} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                    {loading ? "Analizando..." : "Re-analizar"}
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleAnalizar} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                    {loading ? "Analizando..." : "Analizar descripción"}
                  </Button>
                )}
                {actividad.estado === "pendiente_evaluar" && (
  <Button onClick={() => setEvalOpen(true)}>Evaluar</Button>
)}

<EvaluarActividad
  open={evalOpen}
  onOpenChange={setEvalOpen}
  actividadId={actividad.id}
  cursoId={actividad.cursoId}
  alumnos={alumnosStore.porCurso[actividad.cursoId] ?? []}
/>
                <Button onClick={handleProgramar}>Programar actividad</Button>
                
              </div>
            </div>

            {/* OVERLAY */}
            {loading && (
              <div className="pointer-events-none absolute inset-0 z-[1000] grid place-items-center bg-background/60 backdrop-blur-sm">
                <div className="pointer-events-auto flex flex-col items-center gap-2">
                  <svg
                    width={56}
                    height={56}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="xMidYMid"
                    xmlns="http://www.w3.org/2000/svg"
                    className="text-foreground/85"
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
                  <p className="text-xs text-muted-foreground">Analizando descripción…</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmación de cierre con cambios sin guardar */}
      <AlertDialog open={showUnsaved} onOpenChange={setShowUnsaved}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Has re-analizado la actividad y hay cambios sin guardar. ¿Quieres guardarlos antes de cerrar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeWithoutSave}>Descartar</AlertDialogCancel>
            <AlertDialogAction onClick={saveAndClose}>Guardar y cerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Portal del Defensor de Horarios */}
      {defensorDialog}
    </>
  );
}
