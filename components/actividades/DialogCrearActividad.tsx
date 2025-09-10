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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bot, FileUp, WandSparkles } from "lucide-react";

import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { añadirActividad } from "@/store/actividadesPorCurso";

import TinyEditor from "@/components/TinyEditor";
import { CEDetectedList } from "@/components/CEDetectedList";

import ConfigActividadPopover from "@/components/actividades/ConfigActividadPopover";
import type { RA } from "@/components/actividades/ConfigActividadPopover";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId?: string;
  setRefreshKey?: React.Dispatch<React.SetStateAction<number>>;
  asignaturaId?: string;        // ID interno BD
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

// CEDetectedList tipado laxo para no romper nada aquí
const CEDetectedListAny =
  CEDetectedList as unknown as React.ComponentType<{ items: any[]; className?: string }>;

export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
  fechaInicial,
  asignaturaId: asignaturaIdProp,
  asignaturaNombre,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cesDetectados, setCesDetectados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [descripcionHtml, setDescripcionHtml] = useState<string>("");
  const [descripcionPlain, setDescripcionPlain] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  const [cursoIdLocal, setCursoIdLocal] = useState<string | undefined>(cursoId);
  const [asignaturaIdLocal, setAsignaturaIdLocal] = useState<string | undefined>(asignaturaIdProp);
  const [asignaturaCodigoLocal, setAsignaturaCodigoLocal] = useState<string | undefined>(undefined);

  const [cursos, setCursos] = useState<Array<{ id: string; nombre: string }>>([]);
  const [asigsDeCurso, setAsigsDeCurso] = useState<Array<{ id: string; codigo?: string; nombre: string }>>([]);

  const cursoIdEf = cursoId ?? cursoIdLocal;
  const asignaturaIdEf = asignaturaIdProp ?? asignaturaIdLocal;               // para guardar
  const asignaturaCodigoEf = asignaturaCodigoLocal ?? asignaturaIdEf;         // para RA/CE (fallback al id)

  // Nombre de asignatura desde store (si no viene por prop)
  const snap = useSnapshot(asignaturasPorCurso);
  const todasAsignsDelCurso = cursoIdEf ? snap[cursoIdEf] ?? [] : [];
  const asignaturaNombreFromStore =
    (todasAsignsDelCurso.find((a: any) => a.id === asignaturaIdEf)?.nombre as string) || "";
  const asignaturaNombreEf = asignaturaNombre ?? asignaturaNombreFromStore;

  // Al abrir: cargar cursos si no viene por props y reset de archivo
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

    return () => {
      if (!open) setArchivo(null);
    };
  }, [open, cursoId, asignaturaIdProp]);

  // Cargar asignaturas del curso (una sola vez por cambio de curso / apertura)
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
          // autoselección si no hay asignatura marcada
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
    return () => { canceled = true; };
  }, [cursoIdEf, open]); // recarga al reabrir o cambiar curso

  // -------- RA/CE para el popover (se cargan on-demand) ----------
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

        // Normalización robusta a RA[]
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

    return () => { canceled = true; };
  }, [asignaturaCodigoEf]);

  // ================== GUARDAR ==================
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
      asignaturaId: asignaturaIdEf, // ID interno BD
      descripcion: descripcionHtml || descripcion,
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
      setNombre("");
      setDescripcion("");
      setDescripcionHtml("");
      setDescripcionPlain("");
      setArchivo(null);
      setCesDetectados([]);
      setRefreshKey?.((k) => k + 1);
    } catch {
      toast.error("Error al guardar la actividad.");
    } finally {
      setLoading(false);
    }
  };

  const handleExtraerTexto = async (filePath: string) => {
    if (!asignaturaCodigoEf) {
      toast.warning("Selecciona primero curso y asignatura.");
      return;
    }

    const raw = await (window as any).electronAPI.extraerTextoPDF(filePath);
    const texto: string = (raw ?? "").toString();

    const palabras = texto.split(/\s+/).filter(Boolean).length;
    if (!texto || palabras < 5) {
      toast.error(`Texto insuficiente: ${palabras} palabras detectadas.`);
      return;
    }

    const paragraphs: string[] = texto.replace(/\r\n/g, "\n").split(/\n{2,}/);
    const html = `<p>${paragraphs
      .map((p: string) => (p.trim().length ? p.trim().replace(/\n/g, "<br/>") : "<br/>"))
      .join("</p><p>")}</p>`;

    setDescripcionHtml(html);
    setDescripcion(html);
    setDescripcionPlain(texto);
    setDirty(true);

    // Usa el CÓDIGO para el análisis de CE (coincide con getCEsAsignatura)
    const ceDetectados = await (window as any).electronAPI.analizarDescripcionDesdeTexto(
      texto,
      asignaturaCodigoEf
    );
    if (!ceDetectados || ceDetectados.length === 0) {
      toast.warning("No se han detectado CE relevantes.");
    } else {
      toast.success(`🎯 ${ceDetectados.length} CE detectados automáticamente.`);
      setCesDetectados(ceDetectados);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(95vw,1000px)] sm:max-w-[1000px] max-h-[90vh] overflow-y-auto bg-zinc-900"
        onInteractOutside={(e) => {
          const el = e.target as HTMLElement;
          if (el.closest(".tox, .tox-tinymce-aux, .tox-dialog, .tox-menu")) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-bold">
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-1">
              <div className="flex items-baseline gap-2">
                <motion.p variants={itemVariants}>Creando Actividad para</motion.p>
                {asignaturaNombreEf && (
                  <motion.p variants={itemVariants} className="font-bold">
                    {asignaturaNombreEf}
                  </motion.p>
                )}
              </div>
            </motion.div>
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
                    <SelectContent>
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
                      setAsignaturaCodigoLocal(codigo || id); // fallback
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={cursoIdEf ? "Selecciona asignatura" : "Elige antes un curso"} />
                    </SelectTrigger>
                    <SelectContent>
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

              {/* Nombre con botón / Popover */}
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
                    disabled={!asignaturaCodigoEf || raLoading || raOptions.length === 0}
                    onApply={({ suggestedName }) => setNombre(suggestedName)}
                  >
                    <Button type="button" variant="default" className="whitespace-nowrap">
                      <WandSparkles className="w-4 h-4 mr-1" />
                      Crear Actividad
                    </Button>
                  </ConfigActividadPopover>
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

          {/* Descripción (TinyMCE) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="mb-2">Descripción de la actividad</Label>
              {dirty && <Badge variant="destructive">● Cambios sin guardar</Badge>}
            </div>

            <div className="rounded-md border bg-white">
              <TinyEditor
                value={descripcionHtml}
                onChange={(html, plain) => {
                  setDescripcionHtml(html);
                  setDescripcion(html);
                  setDescripcionPlain(plain ?? "");
                }}
                onDirtyChange={setDirty}
                placeholder="Describe la actividad con todo detalle…"
                autoresize
                forceLight
              />
            </div>

            {Array.isArray(cesDetectados) && cesDetectados.length > 0 && (
              <CEDetectedListAny items={cesDetectados} className="mt-2" />
            )}
          </div>

          {/* Archivo + Guardar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <input
                id="archivo"
                type="file"
                accept=".pdf,.doc,.docx,.pages,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const arrayBuffer = await file.arrayBuffer();
                  const ruta = await (window as any).electronAPI.guardarPDF(arrayBuffer, file.name);
                  if (!ruta) {
                    toast.error("No se pudo guardar el archivo.");
                    return;
                  }
                  setArchivo(file);
                  handleExtraerTexto(ruta);
                }}
                disabled={loading}
              />

              <Button asChild variant="secondary" className="gap-2">
                <label htmlFor="archivo">
                  <FileUp className="w-4 h-4" />
                  Subir archivo
                </label>
              </Button>

              <span className="text-xs text-muted-foreground whitespace-nowrap">
                archivos permitidos: PDF / Pages / Word / txt
              </span>

              {archivo && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {archivo.name}
                </span>
              )}
            </div>

            <Button onClick={handleGuardar} disabled={loading} className="px-6">
              <Bot className="w-4 h-4 mr-2" />
              {loading ? "Guardando..." : "Guardar actividad"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
