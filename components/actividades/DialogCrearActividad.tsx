"use client";

import Image from "next/image";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { WandSparkles, Bot, Undo2, Save, CalendarDays } from "lucide-react";

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

// ⬇️ shadcn Calendar
import { Calendar } from "@/components/ui/calendar";

import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { añadirActividad } from "@/store/actividadesPorCurso";

import TinyEditor from "@/components/TinyEditor";
import { CEDetectedList } from "@/components/CEDetectedList";
import ConfigActividadPopover from "@/components/actividades/ConfigActividadPopover";
import type {
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

// Para tipar el elemento CE guardado en chips
type ChipCE = { raCodigo: string; ceCodigo: string; ceDescripcion?: string };

const CEDetectedListAny = CEDetectedList as unknown as React.ComponentType<{
  results: any[];
  className?: string;
}>;

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
  const [cesDetectados, setCesDetectados] = useState<ChipCE[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Loader mientras genera con LLM
  const [showLoader, setShowLoader] = useState(false);

  // Selectores locales si no vienen por props
  const [cursoIdLocal, setCursoIdLocal] = useState<string | undefined>(cursoId);
  const [asignaturaIdLocal, setAsignaturaIdLocal] = useState<
    string | undefined
  >(asignaturaIdProp);
  const [asignaturaCodigoLocal, setAsignaturaCodigoLocal] = useState<
    string | undefined
  >(undefined);

  const cursoIdEf = cursoId ?? cursoIdLocal;
  const asignaturaIdEf = asignaturaIdProp ?? asignaturaIdLocal;
  const asignaturaCodigoEf = asignaturaCodigoLocal ?? asignaturaIdEf;

  const [ultimaConfig, setUltimaConfig] =
    useState<ConfigActividadResult | null>(null);

  const snap = useSnapshot(asignaturasPorCurso);
  const todasAsignsDelCurso = cursoIdEf ? (snap[cursoIdEf] ?? []) : [];
  const asignaturaNombreFromStore =
    (todasAsignsDelCurso.find((a: any) => a.id === asignaturaIdEf)
      ?.nombre as string) || "";
  const asignaturaNombreEf = asignaturaNombre ?? asignaturaNombreFromStore;

  // Datos iniciales
  const [cursos, setCursos] = useState<Array<{ id: string; nombre: string }>>(
    []
  );
  const [asigsDeCurso, setAsigsDeCurso] = useState<
    Array<{ id: string; codigo?: string; nombre: string }>
  >([]);

  // Dialogs secundarios
  const [showResumen, setShowResumen] = useState(false);
  const [showProgramar, setShowProgramar] = useState(false);

  // Programación
  const [fechaProgramada, setFechaProgramada] = useState<Date | undefined>();
  const [fechasDisponibles, setFechasDisponibles] = useState<Set<string>>(
    new Set()
  ); // "YYYY-MM-DD"

  // ====== reset ======
  const resetActividad = (opts?: { keepSelectors?: boolean }) => {
    setNombre("");
    setDescripcionHtml("");
    setCesDetectados([]);
    setUltimaConfig(null);
    setDirty(false);
    setShowResumen(false);
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
        const lista = await (window as any).electronAPI.asignaturasDeCurso(
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

  // CE seleccionados desde Popover
  const setChipsDesdeSeleccion = (cfg: ConfigActividadResult) => {
    const ceList: ChipCE[] = cfg.seleccion.map((s) => ({
      raCodigo: s.raCodigo,
      ceCodigo: s.ceCodigo,
      ceDescripcion: s.ceDescripcion,
    }));
    setCesDetectados(ceList);
  };

  // ====== generar ======
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

      // abrir resumen automáticamente
      setShowResumen(true);
    } catch (e) {
      console.error(e);
      toast.error("Error generando la actividad.");
    } finally {
      setLoading(false);
      setShowLoader(false);
    }
  };

  // ====== guardar ======
  // Nota: generamos id aquí para reutilizarlo si se programa.
  const actividadIdRef = React.useRef<string>(uuidv4());

  const buildActividad = (extra?: Partial<any>) => ({
    id: actividadIdRef.current,
    nombre,
    fecha: (extra?.fecha as string) ?? new Date().toISOString().slice(0, 10),
    cursoId: cursoIdEf,
    asignaturaId: asignaturaIdEf,
    descripcion: descripcionHtml,
    estado: extra?.estado ?? "borrador",
    ...extra,
  });

  const handleGuardar = async () => {
    if (!nombre) return toast.error("Por favor, completa el nombre.");
    if (!cursoIdEf || !asignaturaIdEf)
      return toast.error("Selecciona curso y asignatura.");

    try {
      setLoading(true);
      const nuevaActividad = buildActividad();
      const raw = await (window as any).electronAPI.guardarActividad(
        nuevaActividad as any
      );
      const res = (raw ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok)
        return toast.error(
          `No se guardó: ${res?.error ?? "Error desconocido"}`
        );

      añadirActividad(cursoIdEf!, nuevaActividad as any);
      toast.success("Actividad guardada correctamente.");
      setDirty(false);
      setShowResumen(false);
      onOpenChange(false);
      resetActividad({ keepSelectors: true });
      setRefreshKey?.((k) => k + 1);
    } catch {
      toast.error("Error al guardar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  // ====== programar ======
  const cargarFechasDisponibles = React.useCallback(async () => {
    // Intenta API real
    try {
      if (!cursoIdEf || !asignaturaIdEf) return setFechasDisponibles(new Set());
      if (!ultimaConfig?.duracionMin) return setFechasDisponibles(new Set());

      const api = (window as any).electronAPI;
      if (api?.fechasDisponibles) {
        const arr: string[] =
          (await api.fechasDisponibles(
            cursoIdEf,
            asignaturaIdEf,
            ultimaConfig.duracionMin
          )) ?? [];
        setFechasDisponibles(new Set(arr.map((d) => d.slice(0, 10))));
        return;
      }
    } catch (e) {
      console.warn("fechasDisponibles no disponible, usando fallback…");
    }

    // Fallback: próximos 60 días, solo laborables
    const set = new Set<string>();
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dow = d.getDay(); // 0 dom ... 6 sáb
      if (dow !== 0 && dow !== 6) {
        set.add(d.toISOString().slice(0, 10));
      }
    }
    setFechasDisponibles(set);
  }, [cursoIdEf, asignaturaIdEf, ultimaConfig?.duracionMin]);

  const openProgramar = async () => {
    if (!nombre) return toast.error("Pon un nombre primero.");
    if (!cursoIdEf || !asignaturaIdEf)
      return toast.error("Selecciona curso y asignatura.");
    await cargarFechasDisponibles();
    setShowProgramar(true);
  };

  const handleConfirmarProgramacion = async () => {
    if (!fechaProgramada)
      return toast.error("Selecciona una fecha disponible.");
    try {
      setLoading(true);
      const fechaIso = new Date(
        Date.UTC(
          fechaProgramada.getFullYear(),
          fechaProgramada.getMonth(),
          fechaProgramada.getDate(),
          0,
          0,
          0
        )
      ).toISOString();

      const actividadProgramada = buildActividad({
        estado: "programada",
        fecha: fechaIso,
        duracionMin: ultimaConfig?.duracionMin,
        ces: cesDetectados,
      });

      const raw = await (window as any).electronAPI.guardarActividad(
        actividadProgramada as any
      );
      const res = (raw ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok)
        return toast.error(
          `No se programó: ${res?.error ?? "Error desconocido"}`
        );

      añadirActividad(cursoIdEf!, actividadProgramada as any);
      toast.success("📅 Actividad programada.");
      setDirty(false);
      setShowProgramar(false);
      setShowResumen(false);
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
                        disabled={
                          !asignaturaCodigoEf ||
                          raLoading ||
                          raOptions.length === 0 ||
                          loading
                        }
                        onApply={(cfg) => {
                          setUltimaConfig(cfg);
                          setNombre(cfg.suggestedName);
                          setChipsDesdeSeleccion(cfg);
                          generarActividadIA(cfg);
                        }}
                      >
                        <Button
                          type="button"
                          variant="default"
                          className="whitespace-nowrap"
                          disabled={loading}
                        >
                          <WandSparkles className="w-4 h-4 mr-1" /> Crear
                          Actividad
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
                        Cargando RA/CE…
                      </p>
                    )}
                    {asignaturaCodigoEf &&
                      !raLoading &&
                      raOptions.length === 0 && (
                        <p className="mt-1 text-xs text-destructive">
                          No se han encontrado RA/CE.
                        </p>
                      )}
                  </div>
                </div>
              )}

              {/* Descripción */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="mb-2">Descripción de la actividad</Label>
                  {dirty && (
                    <Badge variant="destructive">● Cambios sin guardar</Badge>
                  )}
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
                    placeholder="Describe la actividad con todo detalle…"
                    autoresize
                    forceLight
                  />
                </div>

                {!!cesDetectados.length && (
                  <CEDetectedListAny results={cesDetectados} className="mt-2" />
                )}
              </div>

              {/* Acciones */}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => resetActividad({ keepSelectors: true })}
                >
                  Limpiar
                </Button>
                <Button
                  onClick={handleGuardar}
                  disabled={loading}
                  className="px-6"
                >
                  <Bot className="w-4 h-4 mr-2" />{" "}
                  {loading ? "Guardando..." : "Guardar actividad"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* DIALOG: RESUMEN TRAS GENERAR */}
      <Dialog open={showResumen} onOpenChange={setShowResumen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Resumen de la actividad</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground">Curso</p>
                <p className="font-medium">{cursoIdEf || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Asignatura</p>
                <p className="font-medium">
                  {asignaturaNombreEf || asignaturaIdEf || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Nombre</p>
                <p className="font-medium">{nombre || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Duración</p>
                <p className="font-medium">
                  {ultimaConfig?.duracionMin
                    ? `${ultimaConfig.duracionMin} min`
                    : "—"}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2">
                RA / CE seleccionados
              </p>
              <div className="flex flex-wrap gap-2">
                {cesDetectados.length === 0 && (
                  <span className="text-sm">—</span>
                )}
                {cesDetectados.map((ce) => (
                  <Badge
                    key={`${ce.raCodigo}-${ce.ceCodigo}`}
                    variant="secondary"
                  >
                    {ce.raCodigo}.{ce.ceCodigo}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowResumen(false)}>
                Volver
              </Button>
              <Button onClick={handleGuardar} disabled={loading}>
                <Save className="w-4 h-4 mr-2" /> Guardar
              </Button>
              <Button onClick={openProgramar} className="px-6">
                <CalendarDays className="w-4 h-4 mr-2" /> Programar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: PROGRAMAR (DATEPICKER) */}
      <Dialog open={showResumen} onOpenChange={setShowResumen}>
        <DialogPortal>
          {/* Overlay con z alto */}
          <DialogOverlay className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[200]" />

          <DialogContent className="sm:max-w-[600px] z-[210]">
            <DialogHeader className="flex flex-col items-center gap-3 text-center">
              <Image
                src="/images/animated-icons/party.gif"
                alt=""
                width={64}
                height={64}
                priority
                unoptimized // mantiene la animación del GIF
                aria-hidden // decorativo
                className="h-16 w-16"
              />
              <DialogTitle className="text-center">
                Actividad creada con éxito!
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
  {/* Datos centrados, uno debajo de otro */}
  <div className="text-sm grid grid-cols-1 gap-3 text-center">
    <div>
      <p className="text-muted-foreground text-xs uppercase">Curso</p>
      <p className="font-medium">{cursoIdEf || "—"}</p>
    </div>
    <div>
      <p className="text-muted-foreground text-xs uppercase">Asignatura</p>
      <p className="font-medium">
        {asignaturaNombreEf || asignaturaIdEf || "—"}
      </p>
    </div>
    <div>
      <p className="text-muted-foreground text-xs uppercase">Nombre de la Actividad</p>
      <p className="font-medium">{nombre || "—"}</p>
    </div>
    <div>
      <p className="text-muted-foreground text-xs uppercase">Duración</p>
      <p className="font-medium">
        {ultimaConfig?.duracionMin ? `${ultimaConfig.duracionMin} min` : "—"}
      </p>
    </div>
  </div>

  <Separator />

  {/* RA/CE centrado */}
  <div className="text-center">
    <p className="text-muted-foreground text-xs uppercase mb-2">
      RA / CE seleccionados
    </p>
    <div className="flex flex-wrap justify-center gap-2">
      {cesDetectados.length === 0 && <span className="text-sm">—</span>}
      {cesDetectados.map((ce) => (
        <Badge key={`${ce.raCodigo}-${ce.ceCodigo}`} variant="secondary">
          {ce.raCodigo}.{ce.ceCodigo}
        </Badge>
      ))}
    </div>
  </div>

  {/* Botones (si también los quieres centrados, deja 'justify-center') */}
  <div className="flex items-center w-full pt-2">
  <Button variant="outline" onClick={() => setShowResumen(false)}>
  <Undo2 className="w-4 h-4 mr-2" /> Volver
  </Button>

  <div className="ml-auto">
    <Button onClick={handleGuardar} disabled={loading}>
      <Save className="w-4 h-4 mr-2" /> Guardar
    </Button>
  </div>
</div>
</div>

          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* LOADER GLOBAL */}
      <LoaderOverlay
        open={showLoader}
        title="Creando actividad…"
        subtitle="Generando propuesta con LLM y preparando el editor"
        lines={[
          "Recopilando RA/CE seleccionados…",
          "Generando estructura de la actividad…",
          "Redactando instrucciones y criterios…",
          "Pensando...",
          "Pensando todavía más...",
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
