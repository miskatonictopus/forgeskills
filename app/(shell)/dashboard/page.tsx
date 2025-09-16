"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSnapshot } from "valtio";
import NuevoAlumno from "@/components/NuevoAlumno";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GraduationCap, BookA, User, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

import { cursoStore } from "@/store/cursoStore";
import { CursoCard } from "@/components/CursoCard";
import { AsignaturaCard } from "@/components/AsignaturaCard";
import { HorarioDialog } from "@/components/HorarioDialog";
import { NuevoCurso } from "@/components/NuevoCurso";
import NuevaAsignatura from "@/components/NuevaAsignatura";
import TablaAlumnos from "@/components/TablaAlumnos";
import { PanelActividadesCompact } from "@/components/panel/PanelActividadesCompact";

/* ---------- Tipos locales ---------- */
type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };
type Descripcion = { duracion?: string; centro?: string; empresa?: string; creditos?: string | number };

type Asignatura = {
  id: string;
  nombre: string;
  creditos?: string | number;
  descripcion?: Descripcion | string;
  RA: RA[];
  cursoId?: string;            // ⚠️ puede venir o no
  curso_id?: string | number;  // a veces en snake_case
};

type Horario = { dia: string; horaInicio: string; horaFin: string };

type ActividadPanel = { id: string; estado?: string };
type CursoPanel = { id: string; nombre?: string; actividades?: ActividadPanel[] };

const pickColorProp = (obj: any): string | null =>
  obj?.color ??
  obj?.colorHex ??
  obj?.color_hex ??
  obj?.colour ??
  obj?.hex ??
  obj?.themeColor ??
  obj?.theme_color ??
  null;


/* ====== Estados para tabs de actividades ====== */
const ESTADOS = ["todos","borrador","analizada","programada","pendiente_evaluar","evaluada","cerrada"] as const;
type EstadoFiltro = (typeof ESTADOS)[number];

export default function Page() {
  const snap = useSnapshot(cursoStore);

  /* -------- Hora en header -------- */
  const [fechaActual, setFechaActual] = useState("");
  useEffect(() => {
    const interval = setInterval(() => {
      const ahora = new Date();
      const txt = ahora.toLocaleString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setFechaActual(txt);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /* -------- Mis cursos para tarjetas -------- */
  const cursosParaPanel: CursoPanel[] = useMemo(
    () =>
      snap.cursos.map((c: any) => ({
        id: c.id,
        nombre: c.nombre ?? c.id,
        actividades: (c.actividades ?? []) as ActividadPanel[],
      })),
    [snap.cursos]
  );

  /* -------- Asignaturas + horarios -------- */
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [horariosPorAsignatura, setHorariosPorAsignatura] = useState<Record<string, Horario[]>>({});
  const [openHorario, setOpenHorario] = useState<string | null>(null);

  // Carga robusta (global -> fallback por curso) + horarios
  const cargarAsignaturas = async () => {
    try {
      const api = (window as any).electronAPI;
      if (!api) return;
  
      // util: aplica color y cursoId a un lote (opcionalmente sabiendo el cursoId)
      const enrichWithColor = async (arr: any[], cursoId?: string | number) => {
        const colorById: Record<string, string> = {};
  
        // bulk por curso si tenemos el cursoId y existe el IPC
        if (cursoId != null && api?.leerColoresAsignaturas) {
          const rows = await api.leerColoresAsignaturas(cursoId);
          for (const it of Array.isArray(rows) ? rows : []) {
            const id = String(it?.id ?? it?.asignaturaId ?? it?.asignatura_id ?? "");
            const col = pickColorProp(it);
            if (id && col) colorById[id] = col;
          }
        }
  
        // mapeo final
        const out = await Promise.all(
          (arr || []).map(async (a: any) => {
            const id = String(a?.id ?? "");
            let color = pickColorProp(a) || colorById[id] || null;
  
            // último recurso: pedir detalle de la asignatura
            if (!color && api?.leerAsignatura && id) {
              try {
                const det = await api.leerAsignatura(id);
                color = pickColorProp(det) || null;
              } catch {}
            }
  
            return {
              ...a,
              color,
              cursoId: a.cursoId ?? a.curso_id ?? (cursoId != null ? String(cursoId) : undefined),
            };
          })
        );
  
        return out;
      };
  
      // 1) intento global
      let list: any[] = (await api.leerAsignaturas?.()) ?? [];
  
      let asigs: any[] = [];
      if (Array.isArray(list) && list.length > 0) {
        // global (no sabemos cursoId → no podemos usar bulk por curso)
        asigs = await enrichWithColor(list);
      } else {
        // 2) fallback por curso
        const perCurso = await Promise.all(
          (snap.cursos || []).map(async (c: any) => {
            const cid = c?.id ?? c?.cursoId ?? c?.uuid;
            if (!cid) return [];
            const base =
              (await api.asignaturasDeCurso?.(cid)) ??
              (await api.leerAsignaturasDeCurso?.(cid)) ??
              [];
            return enrichWithColor(base, cid);
          })
        );
        asigs = perCurso.flat();
      }
  
      // set asignaturas con color ya normalizado
      setAsignaturas(asigs);
  
      // 3) horarios en paralelo
      const mapa: Record<string, Horario[]> = {};
      await Promise.all(
        asigs.map(async (a: any) => {
          const arr: Horario[] = (await api.leerHorarios?.(a.id)) ?? [];
          mapa[a.id] = Array.isArray(arr) ? arr : [];
        })
      );
      setHorariosPorAsignatura(mapa);
    } catch (err) {
      console.error("❌ Error cargando asignaturas:", err);
      toast.error("No se pudieron cargar las asignaturas");
      setAsignaturas([]);
      setHorariosPorAsignatura({});
    }
  };
  

  useEffect(() => { cargarAsignaturas(); /* eslint-disable-next-line */ }, [snap.cursos.length]);

  const handleAsignaturaGuardada = async () => {
    await cargarAsignaturas();
  };

  /* ---- Deduplicado + key estable (cursoId::id) ---- */
  const keyForAsig = (a: Asignatura) =>
    `${String(a.cursoId ?? a.curso_id ?? "nocurso")}::${String(a.id)}`;

  const asignaturasUI = useMemo(() => {
    const seen = new Set<string>();
    const out: Asignatura[] = [];
    for (const a of asignaturas) {
      const k = keyForAsig(a);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(a);
      }
    }
    return out;
  }, [asignaturas]);

  /* -------- Mis alumnos -------- */
  const [filtro, setFiltro] = useState("");
  const [sinAlumnos, setSinAlumnos] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  /* -------- Tabs de actividades -------- */
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>("todos");
  const [countsPorEstado, setCountsPorEstado] = useState<Record<EstadoFiltro, number>>({
    todos: 0,
    borrador: 0,
    analizada: 0,
    programada: 0,
    pendiente_evaluar: 0,
    evaluada: 0,
    cerrada: 0,
  });

  const cursosBase: CursoPanel[] =
    (cursosParaPanel as CursoPanel[] | undefined)?.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      actividades: c.actividades ?? [],
    })) ?? [];

  const cursosFiltrados = useMemo<CursoPanel[]>(() => {
    if (filtroEstado === "todos") return cursosBase;
    return cursosBase.map((curso) => ({
      ...curso,
      actividades: (curso.actividades ?? []).filter(
        (a) => String(a?.estado ?? "").toLowerCase() === filtroEstado
      ),
    }));
  }, [cursosBase, filtroEstado]);

  /* -------- Selector curso para NuevaAsignatura -------- */
  const [cursoIdNuevaAsig, setCursoIdNuevaAsig] = useState<string | null>(snap.cursos[0]?.id ?? null);
  useEffect(() => {
    if (!cursoIdNuevaAsig && snap.cursos.length) setCursoIdNuevaAsig(snap.cursos[0].id);
  }, [snap.cursos, cursoIdNuevaAsig]);

  return (
    <main className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 pl-4 pr-4 pt-1 pb-4 h-[calc(100vh-4rem)] overflow-y-auto bg-zinc-900">
      {/* MIS CURSOS */}
      <section className="rounded-xl border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden bg-zinc-950">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Mis Cursos
            <span className="bg-white text-black text-lg font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
              {snap.cursos.length}
            </span>
          </h2>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="text-xs">+ Nuevo Curso</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Nuevo Curso</DialogTitle></DialogHeader>
              <NuevoCurso />
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="mt-2 mb-4 bg-zinc-800" />

        <div className="flex-1 overflow-y-auto pr-1">
          {snap.cursos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full w-full space-y-4">
              <img src="/images/DKke.gif" alt="Sin cursos" className="w-24 h-24" />
              <p className="text-sm text-muted-foreground text-center">No hay cursos disponibles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-1 xl:grid-cols-2 gap-3">
              {snap.cursos.map((curso) => (
                <CursoCard key={curso.id} curso={curso} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MIS ASIGNATURAS */}
      <section className="rounded-xl border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden bg-zinc-950">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookA className="w-5 h-5" />
            Mis Asignaturas
            <span className="bg-white text-black text-lg font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
              {asignaturasUI.length}
            </span>
          </h2>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="text-xs" disabled={!snap.cursos.length}>
                + Nueva Asignatura
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader><DialogTitle>Nueva Asignatura</DialogTitle></DialogHeader>

              {snap.cursos.length === 0 ? (
                <div className="text-sm text-muted-foreground">Primero crea un curso para asociar la asignatura.</div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="block text-xs mb-1 text-muted-foreground">Curso destino</label>
                    <Select value={cursoIdNuevaAsig ?? undefined} onValueChange={(v) => setCursoIdNuevaAsig(v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un curso" /></SelectTrigger>
                      <SelectContent>
                        {snap.cursos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre ?? c.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {cursoIdNuevaAsig && <NuevaAsignatura cursoId={cursoIdNuevaAsig} onSave={handleAsignaturaGuardada} />}
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="mt-2 mb-4 bg-zinc-800" />

        <div className="flex-1 overflow-y-auto pr-1">
          {asignaturasUI.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full w-full space-y-4">
              <img src="/images/DKke.gif" alt="Sin asignaturas" className="w-24 h-24" />
              <p className="text-sm text-muted-foreground text-center">No hay asignaturas disponibles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-1 xl:grid-cols-2 gap-3">
              {asignaturasUI.map((asig) => {
                const k = keyForAsig(asig);
                return (
                  <React.Fragment key={k}>
                    <AsignaturaCard
                      asignatura={asig}
                      horarios={horariosPorAsignatura[asig.id] || []}
                      onOpenHorario={setOpenHorario}
                      onReload={cargarAsignaturas}
                    />
                    <HorarioDialog
                      open={openHorario === asig.id}
                      onClose={() => setOpenHorario(null)}
                      asignatura={asig}
                      onSave={cargarAsignaturas}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* MIS ALUMNOS */}
      <section className="rounded-xl border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden bg-zinc-950">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <User className="w-5 h-5" />
            Mis Alumnos
          </h2>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="text-xs">+ Añadir alumno/s</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-zinc-800">
              <DialogHeader><DialogTitle>Nuevo Alumno</DialogTitle></DialogHeader>
              <NuevoAlumno onSave={() => setRefreshKey((k) => k + 1)} />
            </DialogContent>
          </Dialog>
        </div>

        <Separator className="mt-2 mb-4 bg-zinc-800" />

        <div className="flex-1 overflow-y-auto pr-1">
          <TablaAlumnos filtro={""} onEmptyChange={setSinAlumnos} refreshKey={refreshKey} />
        </div>
      </section>

      {/* MIS ACTIVIDADES */}
      <section className="rounded-xl border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden bg-zinc-950">
        <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
          <Pencil className="w-5 h-5" />
          Mis Actividades
        </h2>

        <Tabs /* ...igual que antes... */ value={"todos"}>
          {/* deja aquí tus Tabs / counts como ya los tenías */}
        </Tabs>

        <Separator className="mb-3 bg-zinc-800" />

        <div className="flex-1 overflow-hidden">
          {snap.cursos.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground" />
          ) : (
            <div className="h-full overflow-y-auto">
              <PanelActividadesCompact
                cursos={cursosParaPanel}
                filtroEstado={"todos" as EstadoFiltro}
                onCountsUpdate={() => {}}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
