// app/components/actividades/DialogCrearActividadManual.tsx
"use client";

import Image from "next/image";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  WandSparkles,
  Save,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Undo2,
} from "lucide-react";

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
import { Calendar } from "@/components/ui/calendar";

import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { añadirActividad } from "@/store/actividadesPorCurso";

import TinyEditor from "@/components/TinyEditor";
import { CEDetectedList } from "@/components/CEDetectedList";
import ConfigActividadPopover, {
  RA,
  ConfigActividadResult,
} from "@/components/actividades/ConfigActividadPopover";
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

// Chip local CE
type ChipCE = { raCodigo: string; ceCodigo: string; ceDescripcion?: string };
const CEDetectedListAny = CEDetectedList as unknown as React.ComponentType<{
  results: any[];
  className?: string;
}>;

export default function DialogCrearActividadManual({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  asignaturaId: asignaturaIdProp,
  asignaturaNombre,
}: Props) {
  // Campos base
  const [nombre, setNombre] = useState("");
  const [descripcionHtml, setDescripcionHtml] = useState<string>("");
  const [cesSeleccionados, setCesSeleccionados] = useState<ChipCE[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Selectores si no vienen por props
  const [cursoIdLocal, setCursoIdLocal] = useState<string | undefined>(cursoId);
  const [asignaturaIdLocal, setAsignaturaIdLocal] = useState<string | undefined>(
    asignaturaIdProp
  );
  const [asignaturaCodigoLocal, setAsignaturaCodigoLocal] = useState<
    string | undefined
  >(undefined);

  const cursoIdEf = cursoId ?? cursoIdLocal;
  const asignaturaIdEf = asignaturaIdProp ?? asignaturaIdLocal;
  const asignaturaCodigoEf = asignaturaCodigoLocal ?? asignaturaIdEf;

  // RA/CE disponibles
  const [raOptions, setRaOptions] = useState<RA[]>([]);
  const [raLoading, setRaLoading] = useState(false);

  // Programación
  const [showProgramar, setShowProgramar] = useState(false);
  const [fechaProgramada, setFechaProgramada] = useState<Date | undefined>();
  const [fechasDisponibles, setFechasDisponibles] = useState<Set<string>>(
    new Set()
  ); // YYYY-MM-DD

  // Loader overlay
  const [showLoader, setShowLoader] = useState(false);

  // Datos desde stores
  const snap = useSnapshot(asignaturasPorCurso);
  const todasAsignsDelCurso = cursoIdEf ? (snap[cursoIdEf] ?? []) : [];
  const asignaturaNombreFromStore =
    (todasAsignsDelCurso.find((a: any) => a.id === asignaturaIdEf)?.nombre as string) || "";
  const asignaturaNombreEf = asignaturaNombre ?? asignaturaNombreFromStore;

  // Cursos y asignaturas (cuando no vienen por props)
  const [cursos, setCursos] = useState<Array<{ id: string; nombre: string }>>(
    []
  );
  const [asigsDeCurso, setAsigsDeCurso] = useState<
    Array<{ id: string; codigo?: string; nombre: string }>
  >([]);

  // ====== reset ======
  const resetActividad = (opts?: { keepSelectors?: boolean }) => {
    setNombre("");
    setDescripcionHtml("");
    setCesSeleccionados([]);
    setDirty(false);
    setShowProgramar(false);
    setFechaProgramada(undefined);
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
          const cs = await (window as any).electronAPI.leerCursos?.();
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

  // ====== asignaturas del curso ======
  useEffect(() => {
    if (!cursoIdEf) {
      setAsigsDeCurso([]);
      return;
    }
    let canceled = false;
    (async () => {
      try {
        const lista = await (window as any).electronAPI.asignaturasDeCurso?.(
          cursoIdEf
        );
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
        console.error("[DialogCrearActividadManual] asignaturasDeCurso:", e);
        if (!canceled) setAsigsDeCurso([]);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [cursoIdEf, open]);

  // ====== RA/CE ======
  useEffect(() => {
    if (!asignaturaCodigoEf) {
      setRaOptions([]);
      return;
    }
    let canceled = false;
    setRaLoading(true);
    (async () => {
      try {
        const res = await (window as any)?.electronAPI?.getCEsAsignatura?.(
          asignaturaCodigoEf
        );
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

  // ====== aplicar selección desde Popover ======
  const aplicarSeleccionCEs = (cfg: ConfigActividadResult) => {
    const ceList: ChipCE[] = cfg.seleccion.map((s) => ({
      raCodigo: s.raCodigo,
      ceCodigo: s.ceCodigo,
      ceDescripcion: s.ceDescripcion,
    }));
    setCesSeleccionados(ceList);
    if (cfg.suggestedName && !nombre) setNombre(cfg.suggestedName);
  };

  // ====== sugerir RA/CE (opcional) ======
  const sugerirRAyCE = async () => {
    if (!asignaturaCodigoEf) {
      toast.error("Selecciona la asignatura primero.");
      return;
    }
    if (!descripcionHtml || descripcionHtml.trim().length < 10) {
      toast.error("Añade una descripción para poder sugerir RA/CE.");
      return;
    }

    setShowLoader(true);
    try {
      const api = (window as any).electronAPI;

      // Preferimos IPC local si existe
      if (api?.detectarCEsActividad || api?.analizarDescripcion || api?.sugerirCEs) {
        const fn =
          api.detectarCEsActividad ??
          api.analizarDescripcion ??
          api.sugerirCEs;

        const res =
          (await fn({
            asignaturaCodigo: asignaturaCodigoEf,
            descripcionHtml,
          })) ?? [];

        const sugeridos: ChipCE[] = (res ?? []).map((r: any) => ({
          raCodigo: String(r.raCodigo ?? r.ra ?? r.RA ?? r.ra_code ?? ""),
          ceCodigo: String(r.ceCodigo ?? r.ce ?? r.CE ?? r.ce_code ?? ""),
          ceDescripcion: r.ceDescripcion ?? r.descripcion ?? r.desc ?? "",
        }));
        if (sugeridos.length) {
          setCesSeleccionados(sugeridos);
          toast.success("RA/CE sugeridos aplicados.");
        } else {
          toast.message("No se detectaron RA/CE en el texto.");
        }
        return;
      }

      // Fallback HTTP en caso de no tener IPC
      const resp = await fetch("/api/detectar-ce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asignaturaCodigo: asignaturaCodigoEf,
          html: descripcionHtml,
        }),
      });
      const data = await resp.json();
      const sugeridos: ChipCE[] = (data?.resultado ?? data ?? []).map((r: any) => ({
        raCodigo: String(r.raCodigo ?? r.ra ?? r.RA ?? ""),
        ceCodigo: String(r.ceCodigo ?? r.ce ?? r.CE ?? ""),
        ceDescripcion: r.ceDescripcion ?? r.descripcion ?? "",
      }));
      if (sugeridos.length) {
        setCesSeleccionados(sugeridos);
        toast.success("RA/CE sugeridos aplicados.");
      } else {
        toast.message("No se detectaron RA/CE en el texto.");
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron sugerir RA/CE.");
    } finally {
      setShowLoader(false);
    }
  };

  // ====== guardar ======
  const actividadIdRef = React.useRef<string>(uuidv4());
  const buildActividad = (extra?: Partial<any>) => ({
    id: actividadIdRef.current,
    nombre,
    fecha: (extra?.fecha as string) ?? new Date().toISOString().slice(0, 10),
    cursoId: cursoIdEf,
    asignaturaId: asignaturaIdEf,
    descripcion: descripcionHtml,
    estado: extra?.estado ?? "borrador",
    ces: cesSeleccionados,
    ...extra,
  });

  const handleGuardar = async () => {
    if (!cursoIdEf || !asignaturaIdEf) {
      toast.error("Selecciona curso y asignatura.");
      return;
    }
    if (!nombre?.trim()) {
      toast.error("Pon un nombre a la actividad.");
      return;
    }
    if (!cesSeleccionados.length) {
      toast.error("Selecciona al menos un CE.");
      return;
    }

    try {
      setLoading(true);
      const nueva = buildActividad();
      const raw = await (window as any).electronAPI.guardarActividad?.(nueva);
      const res = (raw ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(`No se guardó: ${res?.error ?? "Error desconocido"}`);
        return;
      }
      añadirActividad(cursoIdEf!, nueva as any);
      toast.success("Actividad guardada.");
      setDirty(false);
      onOpenChange(false);
      resetActividad({ keepSelectors: true });
      setRefreshKey?.((k) => k + 1);
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  // ====== programar ======
  const cargarFechasDisponibles = React.useCallback(async () => {
    try {
      if (!cursoIdEf || !asignaturaIdEf) return setFechasDisponibles(new Set());
      const api = (window as any).electronAPI;
      if (api?.fechasDisponibles) {
        const arr: string[] =
          (await api.fechasDisponibles(cursoIdEf, asignaturaIdEf, 60)) ?? [];
        setFechasDisponibles(new Set(arr.map((d) => d.slice(0, 10))));
        return;
      }
    } catch (e) {
      console.warn("fechasDisponibles no disponible, usando fallback…");
    }

    // Fallback: próximos 60 días laborables
    const set = new Set<string>();
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) set.add(d.toISOString().slice(0, 10));
    }
    setFechasDisponibles(set);
  }, [cursoIdEf, asignaturaIdEf]);

  const openProgramar = async () => {
    if (!cursoIdEf || !asignaturaIdEf) return toast.error("Selecciona curso y asignatura.");
    if (!nombre?.trim()) return toast.error("Pon un nombre a la actividad.");
    if (!cesSeleccionados.length) return toast.error("Selecciona al menos un CE.");
    await cargarFechasDisponibles();
    setShowProgramar(true);
  };

  const handleConfirmarProgramacion = async () => {
    if (!fechaProgramada) return toast.error("Selecciona una fecha disponible.");
    try {
      setLoading(true);
      const fechaIso = new Date(
        Date.UTC(
          fechaProgramada.getFullYear(),
          fechaProgramada.getMonth(),
          fechaProgramada.getDate(),
          0, 0, 0
        )
      ).toISOString();

      const a = buildActividad({
        estado: "programada",
        fecha: fechaIso,
      });

      const raw = await (window as any).electronAPI.guardarActividad?.(a);
      const res = (raw ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(`No se programó: ${res?.error ?? "Error desconocido"}`);
        return;
      }
      añadirActividad(cursoIdEf!, a as any);
      toast.success("📅 Actividad programada.");
      setDirty(false);
      setShowProgramar(false);
      onOpenChange(false);
      resetActividad({ keepSelectors: true });
      setRefreshKey?.((k) => k + 1);
    } catch (e) {
      console.error(e);
      toast.error("Error al programar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  // ==== RENDER ====
  return (
    <>
      {/* DIALOG PRINCIPAL */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
          <DialogContent
            className="z-[90] w-[min(95vw,1000px)] sm:max-w-[1000px] max-h-[90vh] overflow-y-auto bg-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2 duration-200"
            onInteractOutside={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest(".tox, .tox-tinymce-aux, .tox-dialog, .tox-menu"))
                e.preventDefault();
            }}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="font-bold">
                Crear actividad manual
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
                          asignaturaIdLocal
                            ? `${asignaturaIdLocal}|${asignaturaCodigoLocal ?? ""}`
                            : undefined
                        }
                        onValueChange={(v) => {
                          const [id, codigo] = v.split("|");
                          setAsignaturaIdLocal(id);
                          setAsignaturaCodigoLocal(codigo || id);
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              cursoIdEf
                                ? "Selecciona asignatura"
                                : "Elige antes un curso"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="z-[110]">
                          {asigsDeCurso.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              {cursoIdEf
                                ? "No hay asignaturas para este curso."
                                : "Elige antes un curso"}
                            </div>
                          ) : (
                            asigsDeCurso.map((a) => (
                              <SelectItem
                                key={a.id}
                                value={`${a.id}|${a.codigo ?? a.id}`}
                              >
                                {a.codigo ?? a.id} - {a.nombre}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Nombre */}
              <div>
                <Label className="mb-2 block">Nombre de la actividad</Label>
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Práctica de arrays"
                />
              </div>

              {/* RA/CE selección + sugerencia */}
              <div className="flex flex-wrap gap-2">
                <ConfigActividadPopover
                  raOptions={raOptions}
                  disabled={!asignaturaCodigoEf || raLoading || raOptions.length === 0 || loading}
                  onApply={(cfg) => aplicarSeleccionCEs(cfg)}
                >
                  <Button type="button" variant="default" disabled={loading}>
                    <ListChecks className="w-4 h-4 mr-2" />
                    Seleccionar RA/CE
                  </Button>
                </ConfigActividadPopover>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={sugerirRAyCE}
                  disabled={!asignaturaCodigoEf || loading || !descripcionHtml}
                >
                  <WandSparkles className="w-4 h-4 mr-2" />
                  Sugerir RA/CE (IA)
                </Button>

                {!!cesSeleccionados.length && (
                  <span className="text-xs text-muted-foreground self-center">
                    {cesSeleccionados.length} CE seleccionados
                  </span>
                )}
              </div>

              {!!cesSeleccionados.length && (
                <CEDetectedListAny results={cesSeleccionados} className="mt-1" />
              )}

              {/* Descripción */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="mb-2">Descripción</Label>
                  {dirty && <Badge variant="destructive">● Cambios sin guardar</Badge>}
                </div>
                <div
                  className="rounded-md border bg-white"
                  onDrop={(e) => e.preventDefault()}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <TinyEditor
                    value={descripcionHtml}
                    onChange={(html) => {
                      setDescripcionHtml(html);
                      setDirty(true);
                    }}
                    onDirtyChange={setDirty}
                    placeholder="Describe objetivos, pasos, entregables, rúbrica…"
                    autoresize
                    forceLight
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => resetActividad({ keepSelectors: true })}
                >
                  <Undo2 className="w-4 h-4 mr-2" />
                  Limpiar
                </Button>
                <Button onClick={openProgramar} variant="outline">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Programar
                </Button>
                <Button onClick={handleGuardar} disabled={loading} className="px-6">
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? "Guardando..." : "Guardar actividad"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* DIALOG: PROGRAMAR */}
      <Dialog open={showProgramar} onOpenChange={setShowProgramar}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[200]" />
          <DialogContent className="sm:max-w-[600px] z-[210]">
            <DialogHeader className="flex flex-col items-center gap-3 text-center">
              <Image
                src="/images/animated-icons/party.gif"
                alt=""
                width={64}
                height={64}
                priority
                unoptimized
                aria-hidden
                className="h-16 w-16"
              />
              <DialogTitle className="text-center">
                Programar actividad
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="text-sm grid grid-cols-1 gap-3 text-center">
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Curso</p>
                  <p className="font-medium">{cursoIdEf || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Asignatura</p>
                  <p className="font-medium">{asignaturaNombreEf || asignaturaIdEf || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Nombre</p>
                  <p className="font-medium">{nombre || "—"}</p>
                </div>
              </div>

              <Separator />

              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={fechaProgramada}
                  onSelect={setFechaProgramada}
                  disabled={(date) => {
                    const key = date.toISOString().slice(0, 10);
                    return !fechasDisponibles.has(key);
                  }}
                  className="rounded-md border"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowProgramar(false)}>
                  Volver
                </Button>
                <Button onClick={handleConfirmarProgramacion}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* LOADER GLOBAL */}
      <LoaderOverlay
        open={showLoader}
        title="Analizando tu descripción…"
        subtitle="Buscando RA/CE relevantes para esta actividad"
        lines={[
          "Leyendo el texto…",
          "Comparando con criterios oficiales…",
          "Calculando relevancia…",
          "Preparando la selección…",
        ]}
        zIndexClassName="z-[3000]"
        blur="lg"
        loaderSize="lg"
        strictBlock
      />
    </>
  );
}
