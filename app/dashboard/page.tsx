"use client";

import React, { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { cursoStore } from "@/store/cursoStore";
import { CursoCard } from "@/components/CursoCard";
import { AsignaturaCard } from "@/components/AsignaturaCard";
import { HorarioDialog } from "@/components/HorarioDialog";
import TablaAlumnos from "@/components/TablaAlumnos";
import NuevoAlumno from "@/components/NuevoAlumno";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NuevoCurso } from "@/components/NuevoCurso";
import NuevaAsignatura from "@/components/NuevaAsignatura";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { GraduationCap, BookA, User, Pencil } from "lucide-react";

// Tipos
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

type Horario = {
  dia: string;
  horaInicio: string;
  horaFin: string;
};

export default function Page() {
  const snap = useSnapshot(cursoStore);
  const [filtro, setFiltro] = useState("");
  const [sinAlumnos, setSinAlumnos] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [openHorario, setOpenHorario] = useState<string | null>(null);
  const [horariosPorAsignatura, setHorariosPorAsignatura] = useState<
    Record<string, Horario[]>
  >({});

  

  // Cargar asignaturas al montar
  useEffect(() => {
    const fetchAsignaturas = async () => {
      try {
        const asignaturasBD =
          (await window.electronAPI?.leerAsignaturas()) as Asignatura[];
        setAsignaturas(asignaturasBD || []);
      } catch (error) {
        console.error("❌ Error al leer asignaturas:", error);
        toast.error("No se pudieron cargar las asignaturas");
      }
    };
    fetchAsignaturas();
  }, []);

  // Cargar horarios después de que se hayan cargado las asignaturas
  useEffect(() => {
    const cargarHorarios = async () => {
      const mapa: Record<string, Horario[]> = {};
      for (const asignatura of asignaturas) {
        const horarios = (await window.electronAPI.leerHorarios(
          asignatura.id
        )) as Horario[];
        mapa[asignatura.id] = horarios;
      }
      setHorariosPorAsignatura(mapa);
    };
    cargarHorarios();
  }, [asignaturas]);

  const cargarAsignaturas = async (id: string) => {
    const nuevas = (await window.electronAPI.leerAsignaturas()) as Asignatura[];
    setAsignaturas(nuevas);
  };

  const totalHoras = Object.values(horariosPorAsignatura)
    .flat()
    .reduce((total, h) => {
      const [h1, m1] = h.horaInicio.split(":").map(Number);
      const [h2, m2] = h.horaFin.split(":").map(Number);
      return total + (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
    }, 0);

  const [fechaActual, setFechaActual] = useState("");

  const handleAsignaturaGuardada = async () => {
    try {
      const nuevas =
        (await window.electronAPI.leerAsignaturas()) as Asignatura[];
      setAsignaturas(nuevas);

      const mapa: Record<string, Horario[]> = {};
      for (const asignatura of nuevas) {
        const horarios = await window.electronAPI.leerHorarios(asignatura.id);
        mapa[asignatura.id] = horarios;
      }
      setHorariosPorAsignatura(mapa);
    } catch (error) {
      console.error("❌ Error al refrescar asignaturas:", error);
      toast.error("No se pudieron refrescar las asignaturas");
    }
  };
  

  useEffect(() => {
    const interval = setInterval(() => {
      const ahora = new Date();
      const fechaFormateada = ahora.toLocaleString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setFechaActual(fechaFormateada);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* HEADER */}
        <header className="flex h-16 items-center gap-2 px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4 mx-2" />
          <div className="flex items-center justify-between w-full px-4 py-2">
            {/* Breadcrumb a la izquierda */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="#">Panel de Control</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Hora actual a la derecha */}
            <span className="text-sm text-muted-foreground font-mono tabular-nums">
              {fechaActual}
            </span>
          </div>
        </header>

        {/* LAYOUT 2x2 */}
        <main className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 pl-4 pr-4 pt-1 pb-4 h-[calc(100vh-4rem)] overflow-y-auto">
          {/* --------------------------------------------
          ---------------MIS CURSOS-------------------
          -------------------------------------------- */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Mis Cursos
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

            <div className="flex-1 overflow-y-auto pr-1">
              {snap.cursos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full w-full space-y-4">
                  <img
                    src="/images/DKke.gif"
                    alt="Sin cursos"
                    className="w-24 h-24"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    No hay cursos disponibles.
                  </p>
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

          {/* --------------------------------------------
          ---------------MIS CURSOS-------------------
          -------------------------------------------- */}

          {/* --------------------------------------------
          ---------------MIS ASIGNATURAS-------------------
          -------------------------------------------- */}

          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookA className="w-5 h-5" />
                Mis Asignaturas
              </h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="text-xs">
                    + Nueva Asignatura
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nueva Asignatura</DialogTitle>
                  </DialogHeader>
                  <NuevaAsignatura onSave={handleAsignaturaGuardada} />
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {asignaturas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full w-full space-y-4">
                  <img
                    src="/images/DKke.gif"
                    alt="Sin asignaturas"
                    className="w-24 h-24"
                  />
                  <p className="text-sm text-muted-foreground text-center">
                    No hay asignaturas disponibles.
                  </p>
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

          {/* --------------------------------------------
          ---------------MIS ASIGNATURAS-------------------
          -------------------------------------------- */}

          {/* --------------------------------------------
          ---------------MIS ALUMNOS-------------------
          -------------------------------------------- */}

<section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
  <div className="flex items-center justify-between mb-2">
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <User className="w-5 h-5" />
      Mis Alumnos
    </h2>

    <div className="flex items-center gap-2">
      {!sinAlumnos && (
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Buscar por nombre o apellidos..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-10 bg-zinc-800 text-white placeholder-zinc-400"
          />
        </div>
      )}
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
          <NuevoAlumno onSave={() => setRefreshKey((prev) => prev + 1)} />
        </DialogContent>
      </Dialog>
    </div>
  </div>

  <div className="flex-1 overflow-y-auto pr-1">
  <TablaAlumnos
  filtro={filtro}
  onEmptyChange={setSinAlumnos}
  refreshKey={refreshKey}
/>
  </div>
</section>


          {/* --------------------------------------------
          ---------------MIS ALUMNOS-------------------
          -------------------------------------------- */}

          {/* MIS ACTIVIDADES */}
          <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-2">
              <Pencil className="w-5 h-5" />
              Mis Actividades
            </h2>
            <div className="flex-1 rounded bg-background/60" />
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
