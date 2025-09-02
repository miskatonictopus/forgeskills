"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScrollText, Check, ListChecks } from "lucide-react";
import { toast } from "sonner";

/* =========== Tipos locales =========== */
type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };

type AsignaturaLite = {
  id: string;               // id de ASIGNATURA
  nombre: string;
  cursoId: string;          // curso al que está vinculada en tu BD
  cursoNombre?: string;
};

type AsignaturaConRA = AsignaturaLite & { RA: RA[] };

type ItemCE = { tipo: "ce"; raCodigo: string; ceCodigo: string; ceDescripcion: string };
type ItemEval = { tipo: "eval"; raCodigo: string; titulo: string };

type Sesion = {
  indice: number;           // 1..N
  fecha?: string;
  items: Array<ItemCE | ItemEval>;
};

/* ============================================================
 * PLANIFICADOR INTERCALADO:
 * 1) Reparte CE de forma equilibrada en TODAS las sesiones S.
 * 2) Calcula, para cada RA, el último índice de sesión donde aparece.
 * 3) Inserta su evaluación en la PRIMERA sesión >= (último+1) que esté libre;
 *    esa sesión queda SOLO para evaluación -> se reubican sus CE al siguiente
 *    slot CE disponible (y así en cascada si hiciera falta).
 * 4) Si no hay hueco suficiente para todas las evaluaciones, avisa.
 * ============================================================*/
function planificarIntercalado(raList: RA[], fechasOSesiones: string[] | number) {
  const S = Array.isArray(fechasOSesiones) ? fechasOSesiones.length : Math.max(1, Number(fechasOSesiones) || 1);
  const fechas = Array.isArray(fechasOSesiones)
    ? fechasOSesiones
    : Array.from({ length: S }).map(() => undefined as string | undefined);

  // Sesiones iniciales vacías
  const sesiones: Sesion[] = Array.from({ length: S }, (_, i) => ({
    indice: i + 1,
    fecha: fechas[i],
    items: [],
  }));

  const evalTotales = raList.length;

  // Aplanar CE
  const ceFlat: ItemCE[] = raList.flatMap((ra) =>
    (ra.CE || []).map((ce) => ({
      tipo: "ce" as const,
      raCodigo: ra.codigo,
      ceCodigo: ce.codigo,
      ceDescripcion: ce.descripcion,
    }))
  );

  // 1) Reparto CE equilibrado en todas las sesiones (si no hay CE, todas vacías)
  if (ceFlat.length > 0) {
    const base = Math.floor(ceFlat.length / S);
    let resto = ceFlat.length % S;
    let cursor = 0;
    for (let i = 0; i < S; i++) {
      const take = base + (resto > 0 ? 1 : 0);
      if (resto > 0) resto -= 1;
      const slice = ceFlat.slice(cursor, cursor + take);
      cursor += take;
      sesiones[i].items.push(...slice);
    }
  }

  // 2) Último índice CE por RA
  const lastIdxByRA = new Map<string, number>();
  for (let i = 0; i < S; i++) {
    for (const it of sesiones[i].items) {
      if (it.tipo === "ce") lastIdxByRA.set(it.raCodigo, i);
    }
  }

  // 3) Calcular posiciones deseadas (last+1) y asignarles un slot libre
  //    Vamos en orden cronológico por cuando acaban sus CE (asc)
  const rasOrdenadas = raList
    .map((ra) => ({
      raCodigo: ra.codigo,
      want: (lastIdxByRA.get(ra.codigo) ?? -1) + 1, // sesión inmediatamente después
    }))
    .sort((a, b) => a.want - b.want || a.raCodigo.localeCompare(b.raCodigo));

  // Para marcar sesiones ya reservadas como "eval"
  const esEval = new Array(S).fill(false);

  // Reubicar CE de una sesión (cuando la convertimos en eval) al siguiente hueco CE
  function reubicarCESesion(origenIdx: number) {
    if (sesiones[origenIdx].items.length === 0) return;

    const mover = sesiones[origenIdx].items.filter((x) => x.tipo === "ce") as ItemCE[];
    sesiones[origenIdx].items = sesiones[origenIdx].items.filter((x) => x.tipo !== "ce");
    if (mover.length === 0) return;

    // Buscar siguiente sesión donde podamos meterlos (no eval)
    let j = origenIdx + 1;
    while (j < S && esEval[j]) j++;
    if (j >= S) {
      // Si no hay hueco, los apilamos en la última sesión NO eval disponible hacia atrás
      j = origenIdx - 1;
      while (j >= 0 && esEval[j]) j--;
      if (j < 0) {
        // no hay dónde meterlos; los perdemos (prácticamente imposible)
        return;
      }
    }
    sesiones[j].items.push(...mover);
  }

  let evalProgramadas = 0;

  for (const ra of rasOrdenadas) {
    // Buscar el primer índice >= want que esté libre para eval
    let idx = Math.max(ra.want, 0);
    // Si cae fuera, no podemos programarla
    while (idx < S && esEval[idx]) idx++;
    if (idx >= S) continue;

    // Convertimos esa sesión en "eval": si tiene CE, los reubicamos
    if (sesiones[idx].items.some((x) => x.tipo === "ce")) {
      reubicarCESesion(idx);
    }
    esEval[idx] = true;

    // Añadimos la evaluación
    sesiones[idx].items.push({
      tipo: "eval",
      raCodigo: ra.raCodigo,
      titulo: `Actividad evaluativa del ${ra.raCodigo}`,
    });

    evalProgramadas++;
  }

  return { sesiones, evalProgramadas, evalTotales };
}

/* ================= Página ================= */
export default function PageProgramacion() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [asignaturas, setAsignaturas] = useState<AsignaturaLite[]>([]);
  const [asigSeleccionada, setAsigSeleccionada] = useState<string>(""); // `${cursoId}:${asignaturaId}`
  const [detalleAsig, setDetalleAsig] = useState<AsignaturaConRA | null>(null);
  const [sesiones, setSesiones] = useState<string[] | number>(0);
  const [preprogramacion, setPreprogramacion] = useState<Sesion[]>([]);
  const [saving, setSaving] = useState(false);

  /* ===== Helpers que usan TU electronAPI ===== */

  // 1) Solo asignaturas “en uso” (vinculadas a cursos en tu BD)
  async function listarAsignaturasEnUso(): Promise<AsignaturaLite[]> {
    const cursos = await window.electronAPI.leerCursos();
    const result: AsignaturaLite[] = [];

    for (const curso of cursos) {
      const cursoId: string = (curso as any).id;
      const cursoNombre: string = (curso as any).acronimo || (curso as any).nombre || "Curso";

      const asigs = await window.electronAPI.leerAsignaturasCurso(cursoId); // [{ id, nombre }]
      for (const a of asigs) {
        result.push({ id: a.id, nombre: a.nombre, cursoId, cursoNombre });
      }
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
    const it = res.items.find((i) => i.asignaturaId === params.asignaturaId);
    return { fechas: it?.fechas ?? [], count: it?.sesiones ?? 0 };
  }

  /* ===== Cargar sólo asignaturas en BD ===== */
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

  /* ===== Al escoger asignatura (par curso:asig) ===== */
  useEffect(() => {
    if (!asigSeleccionada) {
      setDetalleAsig(null);
      setSesiones(0);
      setPreprogramacion([]);
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

        setSesiones(sesionesValue);

        const { sesiones: plan, evalProgramadas, evalTotales } = planificarIntercalado(detalle.RA ?? [], sesionesValue);
        setPreprogramacion(plan);

        if (evalProgramadas < evalTotales) {
          toast.warning(
            `No hay hueco suficiente para todas las evaluaciones intercaladas: ${evalProgramadas}/${evalTotales} programadas.`
          );
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

      const payload = {
        asignaturaId: detalleAsig.id,
        cursoId: detalleAsig.cursoId,
        generadoEn: new Date().toISOString(),
        totalSesiones: Array.isArray(sesiones) ? sesiones.length : sesiones,
        sesiones: preprogramacion,
        meta: {
          asignaturaNombre: detalleAsig.nombre,
          cursoNombre: detalleAsig.cursoNombre,
        },
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
    const totalSes = Array.isArray(sesiones) ? sesiones.length : Number(sesiones || 0);
    const totalRA = (detalleAsig?.RA ?? []).length;
    const totalCE = (detalleAsig?.RA ?? []).reduce((acc, ra) => acc + (ra.CE?.length || 0), 0);
    return { totalSes, totalRA, totalCE };
  }, [detalleAsig, sesiones]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          Crear programación didáctica
        </h1>
        <div className="flex items-center gap-2">
          <Link href="/actividades">
            <Button variant="ghost">Ver actividades</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1) Escoge la asignatura (en uso)</CardTitle>
        </CardHeader>
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
                    cargando
                      ? "Cargando…"
                      : asignaturas.length === 0
                      ? "No hay asignaturas vinculadas"
                      : "Selecciona asignatura"
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
              <Badge variant="secondary">
                <ListChecks className="mr-1 h-3 w-3" /> RA: {(detalleAsig.RA ?? []).length}
              </Badge>
              <Badge variant="secondary">
                CE: {(detalleAsig.RA ?? []).reduce((acc, ra) => acc + (ra.CE?.length || 0), 0)}
              </Badge>
              <Badge variant="secondary">
                Sesiones: {Array.isArray(sesiones) ? sesiones.length : sesiones}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Previsualización de la programación ({resumen.totalSes} sesiones)</CardTitle>
        </CardHeader>
        <CardContent>
          {!detalleAsig ? (
            <p className="text-sm text-muted-foreground">Selecciona una asignatura para generar la propuesta.</p>
          ) : preprogramacion.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay CE registrados o no hay sesiones. Comprueba el plan de horarios.
            </p>
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
                                <li key={idx} className="text-sm">
                                  <span className="font-medium">{it.raCodigo}</span>{" "}
                                  · <span className="font-mono">{it.ceCodigo}</span> — {it.ceDescripcion}
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
            Cada <span className="font-medium">actividad evaluativa</span> se programa en la primera sesión libre
            inmediatamente posterior a la última sesión con CE de su RA. La sesión de evaluación queda dedicada a ello.
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
