"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { v4 as uuidv4 } from "uuid";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bot, WandSparkles } from "lucide-react";

import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { añadirActividad } from "@/store/actividadesPorCurso";

import TinyEditor from "@/components/TinyEditor";
import { CEDetectedList } from "@/components/CEDetectedList";

import ConfigActividadPopover from "@/components/actividades/ConfigActividadPopover";
import type { RA, ConfigActividadResult } from "@/components/actividades/ConfigActividadPopover";

// ⬇️ LoaderOverlay
import LoaderOverlay from "@/components/LoaderOverlay";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId?: string;
  setRefreshKey?: React.Dispatch<React.SetStateAction<number>>;
  asignaturaId?: string;
  asignaturaNombre?: string;
  fechaInicial?: Date;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.2 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// Flex para el componente de resultados
const CEDetectedListAny =
  CEDetectedList as unknown as React.ComponentType<{ results: any[]; className?: string }>;

export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  asignaturaId: asignaturaIdProp,
  asignaturaNombre,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcionHtml, setDescripcionHtml] = useState<string>("");
  const [cesDetectados, setCesDetectados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ⬇️ loader global mientras genera con LLM
  const [showLoader, setShowLoader] = useState(false);

  const [cursoIdLocal, setCursoIdLocal] = useState<string | undefined>(cursoId);
  const [asignaturaIdLocal, setAsignaturaIdLocal] = useState<string | undefined>(asignaturaIdProp);
  const [asignaturaCodigoLocal, setAsignaturaCodigoLocal] = useState<string | undefined>(undefined);

  const [cursos, setCursos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [asigsDeCurso, setAsigsDeCurso] = useState<Array<{ id: string; codigo?: string; nombre: string }>>([]);

  const cursoIdEf = cursoId ?? cursoIdLocal;
  const asignaturaIdEf = asignaturaIdProp ?? asignaturaIdLocal;
  const asignaturaCodigoEf = asignaturaCodigoLocal ?? asignaturaIdEf;

  const [ultimaConfig, setUltimaConfig] = useState<ConfigActividadResult | null>(null);

  const snap = useSnapshot(asignaturasPorCurso);
  const todasAsignsDelCurso = cursoIdEf ? snap[cursoIdEf] ?? [] : [];
  const asignaturaNombreFromStore =
    (todasAsignsDelCurso.find((a: any) => a.id === asignaturaIdEf)?.nombre as string) || "";
  const asignaturaNombreEf = asignaturaNombre ?? asignaturaNombreFromStore;

  // ====== reset ======
  const resetActividad = (opts?: { keepSelectors?: boolean }) => {
    setNombre("");
    setDescripcionHtml("");
    setCesDetectados([]);
    setUltimaConfig(null);
    setDirty(false);
    if (!opts?.keepSelectors) {
      setCursoIdLocal(undefined);
      setAsignaturaIdLocal(undefined);
      setAsignaturaCodigoLocal(undefined);
    }
  };

  // ====== datos iniciales ======
  useEffect(() => {
    if (!open) return;
    (async () => {
      if (!cursoId) {
        try {
          const cs = await (window as any).electronAPI.leerCursos();
          setCursos(cs ?? []);
        } catch (e) {
          console.error(e);
        }
      } else {
        setCursoIdLocal(cursoId);
      }
    })();
    setAsignaturaIdLocal(asignaturaIdProp);
  }, [open, cursoId, asignaturaIdProp]);

  // ====== asignaturas de curso ======
  useEffect(() => {
    if (!cursoIdEf) {
      setAsigsDeCurso([]);
      return;
    }
    let canceled = false;
    (async () => {
      try {
        const lista = await (window as any).electronAPI.asignaturasDeCurso(cursoIdEf);
        const normalizadas = (lista ?? []).map((a: any) => ({
          id: a.id,
          codigo: a.codigo ?? a.id,
          nombre: a.nombre,
        }));
        if (!canceled) {
          setAsigsDeCurso(normalizadas);
          if (!asignaturaIdProp && !asignaturaIdLocal && normalizadas[0]?.id) {
            setAsignaturaIdLocal(normalizadas[0].id);
            setAsignaturaCodigoLocal(normalizadas[0].codigo);
          }
        }
      } catch (e) {
        console.error("[DialogCrearActividad] Error asignaturasDeCurso:", e);
        if (!canceled) setAsigsDeCurso([]);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [cursoIdEf, open]);

  // ====== RA/CE ======
  const [raOptions, setRaOptions] = useState<RA[]>([]);
  const [raLoading, setRaLoading] = useState(false);

  useEffect(() => {
    if (!asignaturaCodigoEf) {
      setRaOptions([]);
      return;
    }
    let canceled = false;
    setRaLoading(true);
    (async () => {
      try {
        const res = await (window as any)?.electronAPI?.getCEsAsignatura?.(asignaturaCodigoEf);
        const raRaw = Array.isArray(res) ? res : (res?.RA ?? res?.ra ?? []);
        const normalized: RA[] = (raRaw ?? []).map((ra: any) => ({
          codigo: String(ra.codigo ?? ra.id ?? ra.code ?? ""),
          descripcion: ra.descripcion ?? ra.nombre ?? "",
          CE: (ra.CE ?? ra.ce ?? []).map((ce: any) => ({
            codigo: String(ce.codigo ?? ce.id ?? ce.code ?? ""),
            descripcion: ce.descripcion ?? ce.nombre ?? "",
          })),
        }));
        if (!canceled) setRaOptions(normalized);
      } catch (err) {
        console.error("Error cargando RA/CE:", err);
        if (!canceled) setRaOptions([]);
      } finally {
        if (!canceled) setRaLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [asignaturaCodigoEf]);

  // CE seleccionados desde el Popover
  const setChipsDesdeSeleccion = (cfg: ConfigActividadResult) => {
    const ceList = cfg.seleccion.map((s) => ({
      raCodigo: s.raCodigo,
      ceCodigo: s.ceCodigo,
      ceDescripcion: s.ceDescripcion,
    }));
    setCesDetectados(ceList as any);
  };

  // ====== generar (muestra LoaderOverlay) ======
  const generarActividadIA = async (cfg: ConfigActividadResult) => {
    if (!cfg?.duracionMin || !cfg?.seleccion?.length) {
      toast.error("Configura duración y al menos un CE.");
      return;
    }
    try {
      setLoading(true);
      setShowLoader(true);

      const res = await fetch("/api/generar-actividad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duracionMin: cfg.duracionMin,
          seleccion: cfg.seleccion,
          asignaturaNombre: asignaturaNombreEf ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo generar la actividad.");
        return;
      }
      const html: string = data.html ?? "";
      if (!html) {
        toast.error("Respuesta vacía del generador.");
        return;
      }
      setDescripcionHtml(html);
      setDirty(true);
      toast.success("✨ Actividad generada en el editor.");
    } catch (e) {
      console.error(e);
      toast.error("Error generando la actividad.");
    } finally {
      setLoading(false);
      setShowLoader(false);
    }
  };

  // ====== guardar ======
  const handleGuardar = async () => {
    if (!nombre) {
      toast.error("Por favor, completa el nombre.");
      return;
    }
    if (!cursoIdEf || !asignaturaIdEf) {
      toast.error("Selecciona curso y asignatura.");
      return;
    }

    const nuevaActividad = {
      id: uuidv4(),
      nombre,
      fecha: new Date().toISOString().slice(0, 10),
      cursoId: cursoIdEf,
      asignaturaId: asignaturaIdEf,
      descripcion: descripcionHtml,
      estado: "borrador",
    };

    try {
      setLoading(true);
      const raw = await (window as any).electronAPI.guardarActividad(nuevaActividad as any);
      const res = (raw ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(`No se guardó: ${res?.error ?? "Error desconocido"}`);
        return;
      }
      añadirActividad(cursoIdEf, nuevaActividad as any);
      toast.success("Actividad guardada correctamente.");
      setDirty(false);
      onOpenChange(false);
      resetActividad({ keepSelectors: true });
      setRefreshKey?.((k) => k + 1);
    } catch {
      toast.error("Error al guardar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          {/* Overlay 60% + blur */}
          <DialogOverlay
            className="
              fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm
              data-[state=open]:animate-in data-[state=closed]:animate-out
              data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
            "
          />

          <DialogContent
            className="
              z-[90] w-[min(95vw,1000px)] sm:max-w-[1000px]
              max-h-[90vh] overflow-y-auto bg-zinc-900
              data-[state=open]:animate-in data-[state=closed]:animate-out
              data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
              data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2
              duration-200
            "
            onInteractOutside={(e) => {
              const el = e.target as HTMLElement;
              // Evita cierre si se interactúa con popups del editor
              if (el.closest(".tox, .tox-tinymce-aux, .tox-dialog, .tox-menu")) e.preventDefault();
            }}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="font-bold">
                Creando Actividad mediante LLM + H
              </DialogTitle>
            </DialogHeader>

            <Separator className="my-3" />

            <div className="space-y-4">
              {/* Curso + Asignatura */}
              {(!cursoId || !asignaturaIdProp) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {!cursoId && (
                    <div>
                      <Label className="mb-2">Curso</Label>
                      <Select
                        value={cursoIdLocal}
                        onValueChange={(v) => {
                          setCursoIdLocal(v);
                          setAsignaturaIdLocal(undefined);
                          setAsignaturaCodigoLocal(undefined);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona curso" />
                        </SelectTrigger>
                        {/* menú por encima del overlay del dialog */}
                        <SelectContent className="z-[110]">
                          {cursos.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.id} - {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!asignaturaIdProp && (
                    <div>
                      <Label className="mb-2">Asignatura</Label>
                      <Select
                        disabled={!cursoIdEf || asigsDeCurso.length === 0}
                        value={
                          asignaturaIdLocal ? `${asignaturaIdLocal}|${asignaturaCodigoLocal ?? ""}` : undefined
                        }
                        onValueChange={(v) => {
                          const [id, codigo] = v.split("|");
                          setAsignaturaIdLocal(id);
                          setAsignaturaCodigoLocal(codigo || id);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={cursoIdEf ? "Selecciona asignatura" : "Elige antes un curso"}
                          />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          {asigsDeCurso.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {cursoIdEf ? "No hay asignaturas para este curso." : "Elige antes un curso"}
                            </div>
                          ) : (
                            asigsDeCurso.map((a) => (
                              <SelectItem key={a.id} value={`${a.id}|${a.codigo ?? a.id}`}>
                                {a.codigo ?? a.id} - {a.nombre}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Nombre + generar */}
                  <div className="md:col-span-2">
                    <Label className="mb-2 block">Nombre de la actividad</Label>
                    <div className="flex gap-2">
                      <Input
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej: Práctica 1"
                        className="flex-1"
                      />

                      <ConfigActividadPopover
                        raOptions={raOptions}
                        disabled={!asignaturaCodigoEf || raLoading || raOptions.length === 0 || loading}
                        onApply={(cfg) => {
                          setUltimaConfig(cfg);
                          setNombre(cfg.suggestedName);
                          setChipsDesdeSeleccion(cfg);
                          generarActividadIA(cfg);
                        }}
                      >
                        <Button type="button" variant="default" className="whitespace-nowrap" disabled={loading}>
                          <WandSparkles className="w-4 h-4 mr-1" /> Crear Actividad
                        </Button>
                      </ConfigActividadPopover>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => resetActividad({ keepSelectors: true })}
                      >
                        Limpiar
                      </Button>
                    </div>

                    {asignaturaCodigoEf && raLoading && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cargando RA/CE de la asignatura seleccionada…
                      </p>
                    )}
                    {asignaturaCodigoEf && !raLoading && raOptions.length === 0 && (
                      <p className="mt-1 text-xs text-destructive">
                        No se han encontrado RA/CE para esta asignatura.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Descripción */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="mb-2">Descripción de la actividad</Label>
                  {dirty && <Badge variant="destructive">● Cambios sin guardar</Badge>}
                </div>

                <div
                  className="rounded-md border bg-white"
                  onDrop={(e) => e.preventDefault()}     // bloquea drop accidental
                  onDragOver={(e) => e.preventDefault()}
                >
                  <TinyEditor
                    value={descripcionHtml}
                    onChange={(html) => {
                      setDescripcionHtml(html);
                      setDirty(true);
                    }}
                    onDirtyChange={setDirty}
                    placeholder="Describe la actividad con todo detalle…"
                    autoresize
                    forceLight
                  />
                </div>

                {Array.isArray(cesDetectados) && cesDetectados.length > 0 && (
                  <CEDetectedListAny results={cesDetectados} className="mt-2" />
                )}
              </div>

              {/* Acciones */}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetActividad({ keepSelectors: true })}
                >
                  Limpiar
                </Button>

                <Button onClick={handleGuardar} disabled={loading} className="px-6">
                  <Bot className="w-4 h-4 mr-2" /> {loading ? "Guardando..." : "Guardar actividad"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Loader global sobre todo mientras se genera con LLM */}
      <LoaderOverlay
        open={showLoader}
        title="Creando actividad…"
        subtitle="Generando propuesta con LLM y preparando el editor"
        lines={[
          "Recopilando RA/CE seleccionados…",
          "Generando estructura de la actividad…",
          "Redactando instrucciones y criterios…",
          "Aplicando formato al editor…",
        ]}
        zIndexClassName="z-[3000]"
        blur="lg"
        loaderSize="lg"
        strictBlock
      />
    </>
  );
}
