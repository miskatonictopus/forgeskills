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
import { Loader2, ScrollText, Check, ListChecks } from "lucide-react";
import { toast } from "sonner";

/* =========== Tipos locales (UI) =========== */

type ItemCEUI = {
  tipo: "ce";
  raCodigo: string;
  ceCodigo: string;
  ceDescripcion: string;
  dificultad?: number;
  minutos?: number;
};
type ItemEvalUI = { tipo: "eval"; raCodigo: string; titulo: string };
type SesionUI = { indice: number; fecha?: string; items: Array<ItemCEUI | ItemEvalUI> };

type GuardarProgramacionPayload = {
  asignaturaId: string;
  cursoId: string;
  generadoEn: string;
  totalSesiones: number;
  sesiones: SesionUI[];
  planLLM?: any; // o LLMPlan | null
  meta?: { asignaturaNombre?: string; cursoNombre?: string };
  modeloLLM?: "gpt-4o" | "gpt-4o-mini" | null;
  replacePrev?: boolean;
  materializarActividades?: boolean;
};


type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };

type AsignaturaLite = {
  id: string;
  nombre: string;
  cursoId: string;
  cursoNombre?: string;
};

type AsignaturaConRA = AsignaturaLite & { RA: RA[] };

type ItemCE = {
  tipo: "ce";
  raCodigo: string;
  ceCodigo: string;
  ceDescripcion: string;
  dificultad?: number;   // NUEVO: badge D1..D5
  minutos?: number;      // NUEVO: tooltip con minutos sugeridos
};
type ItemEval = { tipo: "eval"; raCodigo: string; titulo: string };

// type SesionUI = {
//   indice: number;       // 1..N
//   fecha?: string;
//   items: Array<ItemCE | ItemEval>;
// };

/* ===== Tipos del endpoint /api/planificar-ce ===== */
type LLMSesion = { id: string; fechaISO?: string; minutos: number };
type LLMCE = { id: string; codigo: string; descripcion: string; raCodigo: string };
type LLMItem = { sesionId: string; tipo: "CE" | "EVALUACION_RA"; ceId?: string; raCodigo?: string; minutosOcupados: number };
type LLMPlan = { items: LLMItem[]; cesNoUbicados: string[]; metaCE: Record<string, { dificultad: number; minutos: number }> };

export default function PageProgramacion() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [asignaturas, setAsignaturas] = useState<AsignaturaLite[]>([]);
  const [asigSeleccionada, setAsigSeleccionada] = useState<string>(""); // `${cursoId}:${asignaturaId}`
  const [detalleAsig, setDetalleAsig] = useState<AsignaturaConRA | null>(null);
  const [sesionesFuente, setSesionesFuente] = useState<string[] | number>(0);
  const [preprogramacion, setPreprogramacion] = useState<SesionUI[]>([]);
  const [saving, setSaving] = useState(false);
  const [planLLM, setPlanLLM] = useState<LLMPlan | null>(null);

  /* ===== Helpers que usan TU electronAPI ===== */

  // 1) Solo asignaturas “en uso” (vinculadas a cursos en tu BD)
  async function listarAsignaturasEnUso(): Promise<AsignaturaLite[]> {
    const cursos = await window.electronAPI.leerCursos();
    const result: AsignaturaLite[] = [];

    for (const curso of cursos) {
      const cursoId: string = (curso as any).id;
      const cursoNombre: string = (curso as any).acronimo || (curso as any).nombre || "Curso";
      const asigs = await window.electronAPI.leerAsignaturasCurso(cursoId); // [{ id, nombre }]
      for (const a of asigs) result.push({ id: a.id, nombre: a.nombre, cursoId, cursoNombre });
    }

    return result.sort(
      (x, y) =>
        (x.cursoNombre || "").localeCompare(y.cursoNombre || "") ||
        x.nombre.localeCompare(y.nombre)
    );
  }

  // 2) Detalle con RA/CE (asignatura global) + mantener cursoId
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
          CE: ceRows.map((c: any) => ({ codigo: c.codigo, descripcion: c.descripcion })),
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

  // 3) Sesiones reales (por curso + asignatura)
  async function obtenerSesionesDeAsignatura(params: { cursoId: string; asignaturaId: string }) {
    const res = await window.electronAPI.calcularHorasReales({
      cursoId: params.cursoId,
      asignaturaId: params.asignaturaId,
      incluirFechas: true,
    });
    const it = res.items.find((i: any) => i.asignaturaId === params.asignaturaId);
    return { fechas: it?.fechas ?? [], count: it?.sesiones ?? 0 };
  }

  /* ===== Cargar asignaturas en BD ===== */
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

        // ==== 1) Preparar payload para /api/planificar-ce ====
        const defaultMinutos = 55;
        const ces: LLMCE[] = (detalle.RA ?? []).flatMap((ra) =>
          (ra.CE ?? []).map((ce) => ({
            id: `${ra.codigo}::${ce.codigo}`, // id estable para mapear metaCE
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

        // ==== 2) Llamar al endpoint ====
        const resp = await fetch("/api/planificar-ce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ces,
            sesiones,
            opts: { usarLLM: true, insertarEvaluacionRA: true, penalizarSaltosTema: true, resolverFaltaHueco: "recortar" },
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

        // ==== 3) Transformar plan → preprogramación UI ====
        const ceInfo = new Map(
          (detalle.RA ?? [])
            .flatMap((ra) => (ra.CE ?? []).map((ce) => [ `${ra.codigo}::${ce.codigo}`, { raCodigo: ra.codigo, ceCodigo: ce.codigo, ceDescripcion: ce.descripcion } ]))
        );

        const sesMap = new Map<string, { indice: number; fecha?: string }>();
        if (Array.isArray(sesionesValue)) {
          (sesionesValue as string[]).forEach((fecha, i) => sesMap.set(`S${i + 1}`, { indice: i + 1, fecha }));
        } else {
          for (let i = 0; i < Number(sesionesValue); i++) sesMap.set(`S${i + 1}`, { indice: i + 1 });
        }

        const porSesion = new Map<number, SesionUI>();

        for (const item of plan.items) {
          const sesMeta = sesMap.get(item.sesionId);
          if (!sesMeta) continue;
          if (!porSesion.has(sesMeta.indice)) porSesion.set(sesMeta.indice, { indice: sesMeta.indice, fecha: sesMeta.fecha, items: [] });

          if (item.tipo === "CE" && item.ceId) {
            const info = ceInfo.get(item.ceId);
            const meta = plan.metaCE?.[item.ceId]; // dificultad/minutos
            if (info) {
              porSesion.get(sesMeta.indice)!.items.push({
                tipo: "ce",
                raCodigo: info.raCodigo,
                ceCodigo: info.ceCodigo,
                ceDescripcion: info.ceDescripcion,
                dificultad: meta?.dificultad,
                minutos: meta?.minutos,
              });
            }
          } else if (item.tipo === "EVALUACION_RA" && item.raCodigo) {
            porSesion.get(sesMeta.indice)!.items.push({
              tipo: "eval",
              raCodigo: item.raCodigo,
              titulo: `Actividad evaluativa del ${item.raCodigo}`,
            });
          }
        }

        const totalSes = Array.isArray(sesionesValue) ? (sesionesValue as string[]).length : Number(sesionesValue || 0);
        const sesionesUI = Array.from({ length: totalSes }, (_, i) => {
          const idx = i + 1;
          const exist = porSesion.get(idx);
          const fecha = Array.isArray(sesionesValue) ? (sesionesValue as string[])[i] : undefined;
          return exist ?? { indice: idx, fecha, items: [] };
        }).sort((a, b) => a.indice - b.indice);

        setPreprogramacion(sesionesUI);

        // avisos de hueco
        if (plan.cesNoUbicados?.length) {
          toast.warning(`No caben ${plan.cesNoUbicados.length} CE; se intentó compactar y aún faltan.`);
        } else {
          // si quisieras: podrías detectar si hubo compactación comparando minutos metaCE con los originales
        }
      } catch (e) {
        console.error(e);
        toast.error("Error al preparar la programación");
      } finally {
        setCargando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asigSeleccionada]);

  /* ===== Guardar programación ===== */
  const handleGuardar = async () => {
    if (!detalleAsig) return;

    try {
      setSaving(true);

      const payload: Parameters<typeof window.electronAPI.guardarProgramacionDidactica>[0] = {
        asignaturaId: detalleAsig.id,
        cursoId: detalleAsig.cursoId,
        generadoEn: new Date().toISOString(),
        totalSesiones: Array.isArray(sesionesFuente) ? (sesionesFuente as string[]).length : Number(sesionesFuente || 0),
        sesiones: preprogramacion,
        planLLM,
        meta: { asignaturaNombre: detalleAsig.nombre, cursoNombre: detalleAsig.cursoNombre },
        modeloLLM: "gpt-4o-mini",     // ← ahora se mantiene como literal, no como string
        replacePrev: true,
        materializarActividades: false,
      };

      if (!window.electronAPI.guardarProgramacionDidactica) {
        toast.error("Falta el handler guardarProgramacionDidactica");
        return;
      }
      const res = await window.electronAPI.guardarProgramacionDidactica(payload);
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Sesión</TableHead>
                    <TableHead className="w-40">Fecha</TableHead>
                    <TableHead>Contenido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preprogramacion.map((s) => (
                    <TableRow key={s.indice}>
                      <TableCell className="font-medium">#{s.indice}</TableCell>
                      <TableCell>{s.fecha ? new Date(s.fecha).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        {s.items.length === 0 ? (
                          <span className="text-muted-foreground">Repaso / Práctica / Proyecto</span>
                        ) : (
                          <ul className="list-disc pl-5 space-y-1">
                            {s.items.map((it, idx) => {
                              if (it.tipo === "eval") {
                                return (
                                  <li key={idx} className="text-sm">
                                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium mr-2">
                                      Evaluación
                                    </span>
                                    <span className="font-medium">{it.raCodigo}</span> — {it.titulo}
                                  </li>
                                );
                              }
                              return (
                                <li key={idx} className="text-sm flex items-center gap-2">
                                  <span className="font-medium">{it.raCodigo}</span>
                                  · <span className="font-mono">{it.ceCodigo}</span> — {it.ceDescripcion}
                                  {typeof it.dificultad === "number" && (
                                    <Badge
                                      variant="secondary"
                                      className={
                                        it.dificultad >= 5 ? "bg-red-500/15 text-red-600 border-red-500/30" :
                                        it.dificultad === 4 ? "bg-orange-500/15 text-orange-600 border-orange-500/30" :
                                        it.dificultad === 3 ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                                        it.dificultad === 2 ? "bg-green-500/15 text-green-600 border-green-500/30" :
                                                              "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                      }
                                      title={it.minutos ? `Dificultad ${it.dificultad} · ${it.minutos}′ sugeridos` : `Dificultad ${it.dificultad}`}
                                    >
                                      D{it.dificultad}
                                    </Badge>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Orden y evaluaciones optimizados por el planificador (prerequisitos, rampa de dificultad y evaluación al cerrar cada RA).
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
