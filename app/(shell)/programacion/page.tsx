"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScrollText, Check, ListChecks, GripVertical, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

/* ========= Planificador / Helper de mapeo ========= */
import type { Plan, Sesion as SesionSlot } from "@/lib/planificadorCE";
import { planToUI, type SesionUI } from "@/lib/plan-ui";

/* ========= DnD Kit ========= */
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* =========================
 * Tipos locales / API
 * ========================= */
type CE = { codigo: string; descripcion: string; id?: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };

type AsignaturaLite = {
  id: string;
  nombre: string;
  cursoId: string;
  cursoNombre?: string;
};
type AsignaturaConRA = AsignaturaLite & { RA: RA[] };

/* ===== Tipos del endpoint /api/planificar-ce ===== */
type LLMSesion = { id: string; fechaISO?: string; minutos: number };
type LLMCE = { id: string; codigo: string; descripcion: string; raCodigo: string };
type LLMItem = { sesionId: string; tipo: "CE" | "EVALUACION_RA"; ceId?: string; raCodigo?: string; minutosOcupados: number };
type LLMPlan = { items: LLMItem[]; cesNoUbicados: string[]; metaCE: Record<string, { dificultad: number; minutos: number }> };

/* ===== Persistencia para tu main.ts (ojo: no incluimos "libre") ===== */
type ItemCEPersist = {
  tipo: "ce";
  raCodigo: string;
  ceCodigo: string;
  ceDescripcion: string;
  dificultad?: number;
  minutos?: number;
};
type ItemEvalPersist = { tipo: "eval"; raCodigo: string; titulo: string };
type SesionPersist = { indice: number; fecha?: string; items: Array<ItemCEPersist | ItemEvalPersist> };

type GuardarProgramacionPayload = {
  asignaturaId: string;
  cursoId: string;
  generadoEn: string;
  totalSesiones: number;
  sesiones: SesionPersist[];
  planLLM?: LLMPlan | null;
  meta?: { asignaturaNombre?: string; cursoNombre?: string };
  modeloLLM?: "gpt-4o" | "gpt-4o-mini" | null;
  replacePrev?: boolean;
  materializarActividades?: boolean;
};

/* =========
 * DnD + bloques libres
 * ========= */
type UIItem = (SesionUI["items"][number] | { tipo: "libre"; titulo?: string }) & { _uid: string };
type UISesion = { indice: number; fecha?: string; items: UIItem[] };

function uid() {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
}
function withUID(ses: SesionUI[]): UISesion[] {
  return ses.map(s => ({
    indice: s.indice,
    fecha: s.fecha,
    items: s.items.map(it => ({ ...it, _uid: uid() })),
  }));
}
function findContainerIndex(sesiones: UISesion[], id: string): number {
  return sesiones.findIndex(s => s.items.some(it => it._uid === id));
}
function findItemIndex(ses: UISesion, id: string): number {
  return ses.items.findIndex(it => it._uid === id);
}

/* ========= Droppable (para poder soltar en sesiones vacías) ========= */
function DroppableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[44px] p-2 rounded-md transition-colors ${
        isOver ? "ring-2 ring-primary/40 bg-primary/5" : ""
      }`}
    >
      {children}
    </div>
  );
}

/* ========= Item ordenable + editable si es "libre" ========= */
function SortableItem({
  item,
  onLibreChange,
  onDelete,
}: {
  item: UIItem;
  onLibreChange?: (title: string) => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._uid });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const isEval = item.tipo === "eval";
  const isLibre = item.tipo === "libre";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm bg-background group`}
    >
      {/* handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground"
        title="Arrastrar"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>

      {isEval ? (
        <>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
            Evaluación
          </span>
          <span className="font-medium">{(item as any).raCodigo}</span>
          <span>— {(item as any).titulo}</span>
        </>
      ) : isLibre ? (
        <>
          <input
            className="flex-1 bg-transparent outline-none border-none text-sm"
            placeholder="Escribe tu texto (repaso, práctica, proyecto, etc.)…"
            value={(item as any).titulo ?? ""}
            onChange={(e) => onLibreChange?.(e.target.value)}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
            title="Eliminar bloque"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="font-medium">{(item as any).raCodigo}</span>
          <span>·</span>
          <span className="font-mono">{(item as any).ceCodigo}</span>
          <span>— {(item as any).ceDescripcion}</span>
          {typeof (item as any).dificultad === "number" && (
            <Badge
              variant="secondary"
              className={
                (item as any).dificultad >= 5 ? "bg-red-500/15 text-red-600 border-red-500/30" :
                (item as any).dificultad === 4 ? "bg-orange-500/15 text-orange-600 border-orange-500/30" :
                (item as any).dificultad === 3 ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                (item as any).dificultad === 2 ? "bg-green-500/15 text-green-600 border-green-500/30" :
                                                  "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
              }
              title={
                (item as any).minutos
                  ? `Dificultad ${(item as any).dificultad} · ${(item as any).minutos}′ sugeridos`
                  : `Dificultad ${(item as any).dificultad}`
              }
            >
              D{(item as any).dificultad}
            </Badge>
          )}
        </>
      )}
    </div>
  );
}

/* =========================
 * Página
 * ========================= */
export default function PageProgramacion() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [asignaturas, setAsignaturas] = useState<AsignaturaLite[]>([]);
  const [asigSeleccionada, setAsigSeleccionada] = useState<string>("");
  const [detalleAsig, setDetalleAsig] = useState<AsignaturaConRA | null>(null);
  const [sesionesFuente, setSesionesFuente] = useState<string[] | number>(0);
  const [preprogramacion, setPreprogramacion] = useState<UISesion[]>([]);
  const [saving, setSaving] = useState(false);
  const [planLLM, setPlanLLM] = useState<LLMPlan | null>(null);

  /* ===== DnD sensors ===== */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  /* ===== Electron helpers ===== */
  async function listarAsignaturasEnUso(): Promise<AsignaturaLite[]> {
    const cursos = await window.electronAPI.leerCursos();
    const result: AsignaturaLite[] = [];
    for (const curso of cursos) {
      const cursoId: string = (curso as any).id;
      const cursoNombre: string = (curso as any).acronimo || (curso as any).nombre || "Curso";
      const asigs = await window.electronAPI.leerAsignaturasCurso(cursoId);
      for (const a of asigs) result.push({ id: a.id, nombre: a.nombre, cursoId, cursoNombre });
    }
    return result.sort(
      (x, y) =>
        (x.cursoNombre || "").localeCompare(y.cursoNombre || "") ||
        x.nombre.localeCompare(y.nombre)
    );
  }

  async function getAsignaturaConRAyCE(asignaturaId: string, cursoId: string): Promise<AsignaturaConRA | null> {
    const [asig, raRows] = await Promise.all([
      window.electronAPI.leerAsignatura?.(asignaturaId),
      window.electronAPI.obtenerRAPorAsignatura(asignaturaId),
    ]);
    const RAconCE: RA[] = await Promise.all(
      raRows.map(async (ra: any) => {
        const ceRows = await window.electronAPI.obtenerCEPorRA(ra.id);
        return {
          codigo: ra.codigo,
          descripcion: ra.descripcion,
          CE: ceRows.map((c: any) => ({ codigo: c.codigo, descripcion: c.descripcion, id: c.id })),
        };
      })
    );
    return {
      id: asignaturaId,
      nombre: asig?.nombre ?? "",
      cursoId,
      cursoNombre: undefined,
      RA: RAconCE,
    };
  }

  async function obtenerSesionesDeAsignatura(params: { cursoId: string; asignaturaId: string }) {
    const res = await window.electronAPI.calcularHorasReales({
      cursoId: params.cursoId,
      asignaturaId: params.asignaturaId,
      incluirFechas: true,
    });
    const it = res.items.find((i: any) => i.asignaturaId === params.asignaturaId);
    return { fechas: it?.fechas ?? [], count: it?.sesiones ?? 0 };
  }

  /* ===== Cargar asignaturas ===== */
  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const res = await listarAsignaturasEnUso();
        setAsignaturas(res);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar las asignaturas en uso");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  /* ===== Al escoger asignatura ===== */
  useEffect(() => {
    if (!asigSeleccionada) {
      setDetalleAsig(null);
      setSesionesFuente(0);
      setPreprogramacion([]);
      setPlanLLM(null);
      return;
    }

    (async () => {
      try {
        setCargando(true);

        const [cursoId, asignaturaId] = asigSeleccionada.split(":");
        const detalle = await getAsignaturaConRAyCE(asignaturaId, cursoId);
        if (!detalle) {
          toast.error("No se pudieron cargar RA/CE");
          setDetalleAsig(null);
          return;
        }

        const match = asignaturas.find((a) => a.id === asignaturaId && a.cursoId === cursoId);
        detalle.cursoNombre = match?.cursoNombre;
        setDetalleAsig(detalle);

        const { fechas, count } = await obtenerSesionesDeAsignatura({ cursoId, asignaturaId });
        const sesionesValue = (fechas.length > 0 ? fechas : count) || 0;
        setSesionesFuente(sesionesValue);

        const defaultMinutos = 55;

        const ces: LLMCE[] = (detalle.RA ?? []).flatMap((ra) =>
          (ra.CE ?? []).map((ce) => ({
            id: `${ra.codigo}::${ce.codigo}`,
            codigo: ce.codigo,
            descripcion: ce.descripcion,
            raCodigo: ra.codigo,
          }))
        );

        const sesiones: LLMSesion[] = Array.isArray(sesionesValue)
          ? (sesionesValue as string[]).map((fechaISO: string, i: number) => ({
              id: `S${i + 1}`,
              fechaISO,
              minutos: defaultMinutos,
            }))
          : Array.from({ length: Number(sesionesValue) }).map((_, i) => ({
              id: `S${i + 1}`,
              minutos: defaultMinutos,
            }));

        if (ces.length === 0) {
          setPreprogramacion([]);
          setPlanLLM(null);
          toast.message("No hay CE registrados en esta asignatura.");
          return;
        }
        if (sesiones.length === 0) {
          setPreprogramacion([]);
          setPlanLLM(null);
          toast.message("No hay sesiones planificadas para esta asignatura.");
          return;
        }

        const resp = await fetch("/api/planificar-ce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ces,
            sesiones,
            opts: {
              usarLLM: true,
              insertarEvaluacionRA: true,
              resolverFaltaHueco: "recortar",
              estrategia: "intercalado-estricto",
              maxCEporSesion: 3,
            },
          }),
        });

        const data = await resp.json();
        if (!data?.ok) {
          toast.error(data?.error || "No se pudo generar el plan con LLM.");
          setPreprogramacion([]);
          setPlanLLM(null);
          return;
        }

        const plan: LLMPlan = data.plan;
        setPlanLLM(plan);

        const catalogo: Record<string, { raCodigo: string; ceCodigo: string; ceDescripcion: string }> = {};
        (detalle.RA ?? []).forEach((ra) => {
          (ra.CE ?? []).forEach((ce) => {
            const ceId = `${ra.codigo}::${ce.codigo}`;
            catalogo[ceId] = { raCodigo: ra.codigo, ceCodigo: ce.codigo, ceDescripcion: ce.descripcion };
          });
        });

        const slots: SesionSlot[] = Array.isArray(sesionesValue)
          ? (sesionesValue as string[]).map((fechaISO, i) => ({ id: `S${i + 1}`, fechaISO, minutos: defaultMinutos }))
          : Array.from({ length: Number(sesionesValue) }).map((_, i) => ({ id: `S${i + 1}`, minutos: defaultMinutos }));

        const sesionesUI = planToUI(slots, plan as unknown as Plan, catalogo);
        setPreprogramacion(withUID(sesionesUI));
      } catch (e) {
        console.error(e);
        toast.error("Error al preparar la programación");
      } finally {
        setCargando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asigSeleccionada]);

  /* ===== Añadir / editar / borrar bloques libres ===== */
  const addLibre = (indice: number) => {
    setPreprogramacion((prev) => {
      const clone = prev.map(s => ({ ...s, items: [...s.items] }));
      const s = clone.find(x => x.indice === indice);
      if (!s) return prev;
      s.items.push({ tipo: "libre", titulo: "", _uid: uid() });
      return clone;
    });
  };

  const updateLibre = (uid: string, title: string) => {
    setPreprogramacion(prev => prev.map(s => ({
      ...s,
      items: s.items.map(it => it._uid === uid ? { ...it, titulo: title } : it),
    })));
  };

  const deleteItem = (uid: string) => {
    setPreprogramacion(prev => prev.map(s => ({
      ...s,
      items: s.items.filter(it => it._uid !== uid),
    })));
  };
  
  /* ===== DnD ===== */


  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setPreprogramacion((prev) => {
      const fromSessIdx = findContainerIndex(prev, String(active.id));
      if (fromSessIdx < 0) return prev;
      const fromItemIdx = findItemIndex(prev[fromSessIdx], String(active.id));
      if (fromItemIdx < 0) return prev;

      let toSessIdx = -1;
      let toIndex = -1;

      const overId = String(over.id);
      if (overId.startsWith("sess-")) {
        toSessIdx = prev.findIndex(s => `sess-${s.indice}` === overId);
        toIndex = toSessIdx >= 0 ? prev[toSessIdx].items.length : -1;
      } else {
        toSessIdx = findContainerIndex(prev, overId);
        if (toSessIdx >= 0) toIndex = Math.max(0, findItemIndex(prev[toSessIdx], overId));
      }

      if (toSessIdx < 0 || toIndex < 0) return prev;

      const clone = prev.map(s => ({ ...s, items: [...s.items] }));
      const [moved] = clone[fromSessIdx].items.splice(fromItemIdx, 1);
      clone[toSessIdx].items.splice(toIndex, 0, moved);
      return clone;
    });
  };

  /* ===== Guardar ===== */
  const handleGuardar = async () => {
    if (!detalleAsig) return;

    try {
      setSaving(true);

      // ⚠️ Por compatibilidad: ignoramos "libre" en persistencia.
      const sesionesPersist: SesionPersist[] = preprogramacion.map((s) => ({
        indice: s.indice,
        fecha: s.fecha,
        items: s.items
          .filter((it: any) => it.tipo === "ce" || it.tipo === "eval")
          .map((it: any) =>
            it.tipo === "ce"
              ? {
                  tipo: "ce",
                  raCodigo: it.raCodigo,
                  ceCodigo: it.ceCodigo,
                  ceDescripcion: it.ceDescripcion,
                  dificultad: typeof it.dificultad === "number" ? it.dificultad : undefined,
                  minutos: typeof it.minutos === "number" ? it.minutos : undefined,
                } as ItemCEPersist
              : { tipo: "eval", raCodigo: it.raCodigo, titulo: it.titulo } as ItemEvalPersist
          ),
      }));

      const payload: GuardarProgramacionPayload = {
        asignaturaId: detalleAsig.id,
        cursoId: detalleAsig.cursoId,
        generadoEn: new Date().toISOString(),
        totalSesiones: Array.isArray(sesionesFuente)
          ? (sesionesFuente as string[]).length
          : Number(sesionesFuente || 0),
        sesiones: sesionesPersist,
        planLLM,
        meta: { asignaturaNombre: detalleAsig.nombre, cursoNombre: detalleAsig.cursoNombre },
        modeloLLM: "gpt-4o-mini",
        replacePrev: true,
        materializarActividades: false,
      };

      if (!window.electronAPI.guardarProgramacionDidactica) {
        toast.error("Falta el handler guardarProgramacionDidactica");
        return;
      }

      const res = await window.electronAPI.guardarProgramacionDidactica(payload as any);
      if (res.ok) {
        toast.success("Programación didáctica guardada");
        router.push(`/programacion/${detalleAsig.id}`);
      } else {
        toast.message(res.error ?? "Se generó la programación, pero no se pudo guardar.");
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar la programación");
    } finally {
      setSaving(false);
    }
  };

  const resumen = useMemo(() => {
    const totalSes = Array.isArray(sesionesFuente) ? (sesionesFuente as string[]).length : Number(sesionesFuente || 0);
    const totalRA = (detalleAsig?.RA ?? []).length;
    const totalCE = (detalleAsig?.RA ?? []).reduce((acc, ra) => acc + (ra.CE?.length || 0), 0);
    return { totalSes, totalRA, totalCE };
  }, [detalleAsig, sesionesFuente]);

  /* ===== UI ===== */
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          Crear programación didáctica
        </h1>
        <div className="flex items-center gap-2">
          <Link href="/actividades"><Button variant="ghost">Ver actividades</Button></Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>1) Escoge la asignatura (en uso)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr] items-center">
            <Label htmlFor="asignatura">Asignatura</Label>
            <Select
              value={asigSeleccionada}
              onValueChange={(v) => setAsigSeleccionada(v)}
              disabled={cargando || asignaturas.length === 0}
            >
              <SelectTrigger id="asignatura" className="w-full">
                <SelectValue
                  placeholder={
                    cargando ? "Cargando…" :
                    asignaturas.length === 0 ? "No hay asignaturas vinculadas" : "Selecciona asignatura"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {(() => {
                  const byCurso = asignaturas.reduce<Record<string, AsignaturaLite[]>>((acc, a) => {
                    const key = a.cursoNombre || "Sin curso";
                    (acc[key] ||= []).push(a);
                    return acc;
                  }, {});
                  return Object.entries(byCurso).map(([curso, items]) => (
                    <SelectGroup key={curso}>
                      <SelectLabel>{curso}</SelectLabel>
                      {items.map((a) => (
                        <SelectItem key={`${a.cursoId}:${a.id}`} value={`${a.cursoId}:${a.id}`}>
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>

          {cargando ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparando datos…
            </div>
          ) : detalleAsig ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary"><ListChecks className="mr-1 h-3 w-3" /> RA: {(detalleAsig.RA ?? []).length}</Badge>
              <Badge variant="secondary">CE: {(detalleAsig.RA ?? []).reduce((acc, ra) => acc + (ra.CE?.length || 0), 0)}</Badge>
              <Badge variant="secondary">Sesiones: {Array.isArray(sesionesFuente) ? (sesionesFuente as string[]).length : Number(sesionesFuente || 0)}</Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2) Previsualización de la programación ({resumen.totalSes} sesiones)</CardTitle></CardHeader>
        <CardContent>
          {!detalleAsig ? (
            <p className="text-sm text-muted-foreground">Selecciona una asignatura para generar la propuesta.</p>
          ) : preprogramacion.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay CE registrados o no hay sesiones. Comprueba el plan de horarios.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Sesión</TableHead>
                      <TableHead className="w-40">Fecha</TableHead>
                      <TableHead>Contenido (arrastra para reordenar o mover entre sesiones)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preprogramacion.map((s) => (
                      <TableRow key={s.indice}>
                        <TableCell className="font-medium">#{s.indice}</TableCell>
                        <TableCell>{s.fecha ? new Date(s.fecha).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>
                          <DroppableCell id={`sess-${s.indice}`}>
                            <SortableContext
                              items={s.items.map(it => it._uid)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="flex flex-col gap-1">
                                {s.items.length === 0 && (
                                  <div className="text-sm text-muted-foreground mb-1">
                                    Suelta aquí para programar en esta sesión
                                  </div>
                                )}

                                {s.items.map((it) => (
                                  <SortableItem
                                    key={it._uid}
                                    item={it}
                                    onLibreChange={it.tipo === "libre" ? (title) => updateLibre(it._uid, title) : undefined}
                                    onDelete={it.tipo === "libre" ? () => deleteItem(it._uid) : undefined}
                                  />
                                ))}

                                <div className="pt-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => addLibre(s.indice)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Añadir nota
                                  </Button>
                                </div>
                              </div>
                            </SortableContext>
                          </DroppableCell>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Orden y evaluaciones optimizados por el planificador; puedes ajustar manualmente arrastrando los elementos.
            Los bloques libres son solo notas de planificación (ahora mismo no se guardan en BD).
          </p>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleGuardar} disabled={!detalleAsig || preprogramacion.length === 0 || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Generar y guardar programación
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-muted-foreground">
              RA: {resumen.totalRA} · CE: {resumen.totalCE} · Sesiones: {resumen.totalSes}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
