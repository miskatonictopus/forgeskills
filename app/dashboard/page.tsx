"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSnapshot } from "valtio";
import NuevoAlumno from "@/components/NuevoAlumno";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from "@/components/ui/breadcrumb";
import { GraduationCap, BookA, User, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/theme-toggle";
import { TimerTray } from "@/components/TimerTray";


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
type Descripcion = { duracion: string; centro: string; empresa: string };

type Asignatura = {
  id: string;
  nombre: string;
  creditos: string;
  descripcion: Descripcion;
  RA: RA[];
};

type Horario = { dia: string; horaInicio: string; horaFin: string };

type ActividadPanel = { id: string; estado?: string };
type CursoPanel = { id: string; nombre?: string; actividades?: ActividadPanel[] };

/* ====== Estados para tabs de actividades ====== */
const ESTADOS = [
  "todos",
  "borrador",
  "analizada",
  "programada",
  "pendiente_evaluar",
  "evaluada",
  "cerrada",
] as const;
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
        actividades: (c.actividades ?? []) as ActividadPanel[], // si ya vienen
      })),
    [snap.cursos]
  );

  /* -------- Asignaturas + horarios -------- */
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [horariosPorAsignatura, setHorariosPorAsignatura] = useState<Record<string, Horario[]>>({});
  const [openHorario, setOpenHorario] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const asignaturasBD = (await window.electronAPI?.leerAsignaturas()) as Asignatura[];
        setAsignaturas(asignaturasBD || []);
      } catch (err) {
        console.error("❌ Error al leer asignaturas:", err);
        toast.error("No se pudieron cargar las asignaturas");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const mapa: Record<string, Horario[]> = {};
      for (const asig of asignaturas) {
        const horarios = (await window.electronAPI.leerHorarios(asig.id)) as Horario[];
        mapa[asig.id] = horarios ?? [];
      }
      setHorariosPorAsignatura(mapa);
    })();
  }, [asignaturas]);

  const cargarAsignaturas = async (_id?: string) => {
    const nuevas = (await window.electronAPI.leerAsignaturas()) as Asignatura[];
    setAsignaturas(nuevas ?? []);
  };

  const handleAsignaturaGuardada = async () => {
    try {
      const nuevas = (await window.electronAPI.leerAsignaturas()) as Asignatura[];
      setAsignaturas(nuevas ?? []);
      const mapa: Record<string, Horario[]> = {};
      for (const asig of nuevas ?? []) {
        const horarios = (await window.electronAPI.leerHorarios(asig.id)) as Horario[];
        mapa[asig.id] = horarios ?? [];
      }
      setHorariosPorAsignatura(mapa);
    } catch (err) {
      console.error("❌ Error al refrescar asignaturas:", err);
      toast.error("No se pudieron refrescar las asignaturas");
    }
  };

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

  // base null-safe (si alguna tarjeta trae actividades ya precargadas)
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* HEADER */}
        <header className="flex h-16 items-center gap-2 px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 mx-2" />
          <div className="flex items-center justify-between w-full px-4 py-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Panel de Control</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <span className="text-xl text-white font-bold tabular-nums">{fechaActual}</span>
            <TimerTray />
            <ThemeToggle />
          </div>
        </header>

        {/* LAYOUT 2x2 */}
        <main className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 pl-4 pr-4 pt-1 pb-4 h-[calc(100vh-4rem)] overflow-y-auto">
          {/* MIS CURSOS */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
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
                  <Button variant="secondary" className="text-xs">
                    + Nuevo Curso
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nuevo Curso</DialogTitle>
                  </DialogHeader>
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
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookA className="w-5 h-5" />
                Mis Asignaturas
                <span className="bg-white text-black text-lg font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-sm">
                  {asignaturas.length}
                </span>
              </h2>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="text-xs" disabled={!snap.cursos.length}>
                    + Nueva Asignatura
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nueva Asignatura</DialogTitle>
                  </DialogHeader>

                  {snap.cursos.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Primero crea un curso para asociar la asignatura.</div>
                  ) : (
                    <>
                      {/* Selector de curso destino */}
                      <div className="mb-3">
                        <label className="block text-xs mb-1 text-muted-foreground">Curso destino</label>
                        <Select value={cursoIdNuevaAsig ?? undefined} onValueChange={(v) => setCursoIdNuevaAsig(v)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona un curso" />
                          </SelectTrigger>
                          <SelectContent>
                            {snap.cursos.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nombre ?? c.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Form nueva asignatura */}
                      {cursoIdNuevaAsig && (
                        <NuevaAsignatura cursoId={cursoIdNuevaAsig} onSave={handleAsignaturaGuardada} />
                      )}
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            <Separator className="mt-2 mb-4 bg-zinc-800" />

            <div className="flex-1 overflow-y-auto pr-1">
              {asignaturas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full w-full space-y-4">
                  <img src="/images/DKke.gif" alt="Sin asignaturas" className="w-24 h-24" />
                  <p className="text-sm text-muted-foreground text-center">No hay asignaturas disponibles.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-1 xl:grid-cols-2 gap-3">
                  {asignaturas.map((asig) => (
                    <React.Fragment key={asig.id}>
                      <AsignaturaCard
                        asignatura={asig}
                        horarios={horariosPorAsignatura[asig.id] || []}
                        onOpenHorario={setOpenHorario}
                        onReload={() => cargarAsignaturas(asig.id)}
                      />
                      <HorarioDialog
                        open={openHorario === asig.id}
                        onClose={() => setOpenHorario(null)}
                        asignatura={asig}
                        onSave={() => cargarAsignaturas(asig.id)}
                      />
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* MIS ALUMNOS */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <User className="w-5 h-5" />
                Mis Alumnos
              </h2>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="text-xs">
                    + Añadir alumno/s
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nuevo Alumno</DialogTitle>
                  </DialogHeader>
                  <NuevoAlumno onSave={() => setRefreshKey((k) => k + 1)} />
                </DialogContent>
              </Dialog>
            </div>

            <Separator className="mt-2 mb-4 bg-zinc-800" />

            {!sinAlumnos && (
              <div className="flex justify-end mb-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o apellidos..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="pl-10 bg-zinc-800 text-white placeholder-zinc-400 w-full"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto pr-1">
              <TablaAlumnos filtro={filtro} onEmptyChange={setSinAlumnos} refreshKey={refreshKey} />
            </div>
          </section>

          {/* MIS ACTIVIDADES */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Pencil className="w-5 h-5" />
              Mis Actividades
            </h2>

            {/* Tabs de estado */}
            <Tabs value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoFiltro)} className="mb-3">
  {/* Fila 1 */}
  <TabsList className="w-full justify-start gap-1">
    {(["todos","borrador","analizada","programada"] as EstadoFiltro[]).map((estado) => (
      <TabsTrigger key={estado} value={estado} className="flex items-center gap-1 text-xs">
        {estado === "todos"
          ? "Todos"
          : estado.charAt(0).toUpperCase() + estado.slice(1).replaceAll("_", " ")}
        <Badge variant="secondary" className="ml-1">{countsPorEstado[estado] ?? 0}</Badge>
      </TabsTrigger>
    ))}
  </TabsList>

  {/* Fila 2 */}
  <div className="mt-2">
    <TabsList className="w-full justify-start gap-1">
      {(["pendiente_evaluar","evaluada","cerrada"] as EstadoFiltro[]).map((estado) => (
        <TabsTrigger key={estado} value={estado} className="flex items-center gap-1 text-xs">
          {estado === "pendiente_evaluar" ? "Pendiente de evaluar" : estado.charAt(0).toUpperCase() + estado.slice(1)}
          <Badge variant="secondary" className="ml-1">{countsPorEstado[estado] ?? 0}</Badge>
        </TabsTrigger>
      ))}
    </TabsList>
  </div>
</Tabs>

            <Separator className="mb-3 bg-zinc-800" />

            <div className="flex-1 overflow-hidden">
              {snap.cursos.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">

                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  <PanelActividadesCompact
                    cursos={cursosParaPanel}
                    filtroEstado={filtroEstado}
                    onCountsUpdate={(counts) => {
                      const next: Record<EstadoFiltro, number> = {
                        todos: counts.todos ?? 0,
                        borrador: counts.borrador ?? 0,
                        analizada: counts.analizada ?? 0,
                        programada: counts.programada ?? 0,
                        pendiente_evaluar: counts.pendiente_evaluar ?? 0,
                        evaluada: counts.evaluada ?? 0,
                        cerrada: counts.cerrada ?? 0,
                      };
                      setCountsPorEstado((prev) => {
                        const same = ESTADOS.every((k) => prev[k] === next[k]);
                        return same ? prev : next;
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
