"use client";

import { cursoStore } from "@/store/cursoStore";
import { useSnapshot } from "valtio";
import { useRef } from "react";
import React from "react";
import { useEffect, useState } from "react";
import { DialogEliminarFlow } from "@/components/DialogEliminarFlow";
import { CursoCard } from "@/components/CursoCard";
import TablaAlumnos from "@/components/TablaAlumnos";
import { AppSidebar } from "@/components/app-sidebar";
import { AsignaturaCard } from "@/components/AsignaturaCard";
import { Separator } from "@/components/ui/separator";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { HorarioDialog } from "@/components/HorarioDialog";
import { toast } from "sonner";

// Tipos de datos

type Curso = {
  id: string;
  acronimo: string;
  nombre: string;
  nivel: string;
  grado: string;
  clase: string;
};

type CE = {
  codigo: string;
  descripcion: string;
};

type RA = {
  codigo: string;
  descripcion: string;
  CE: CE[];
};

type Descripcion = {
  duracion: string;
  centro: string;
  empresa: string;
};

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
  const [cursoAEliminar, setCursoAEliminar] = useState<{
    id: string;
    nombre: string;
  } | null>(null);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [openHorario, setOpenHorario] = useState<string | null>(null);
  const [horariosPorAsignatura, setHorariosPorAsignatura] = useState<
    Record<string, Horario[]>
  >({});

  // Cargar asignaturas
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

  // Leer horarios

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

  // Guardar horarios en memoria
  const handleGuardarHorario = (
    asignaturaId: string,
    nuevosHorarios: Horario[]
  ) => {
    setHorariosPorAsignatura((prev) => ({
      ...prev,
      [asignaturaId]: nuevosHorarios,
    }));

    toast.success("Horario guardado correctamente");
    console.log("✅ Horario guardado para", asignaturaId, nuevosHorarios);
  };

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
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  <section className="rounded border border-muted bg-muted/10 p-4 flex flex-col overflow-hidden">
  <div className="flex items-center justify-between mb-2">
    <h2 className="text-xl font-semibold flex items-center gap-2">
      <User className="w-5 h-5" />
      Mis Alumnos
    </h2>

    {/* Contenedor buscador + botón */}
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
          <NuevoAlumno />
        </DialogContent>
      </Dialog>
    </div>
  </div>

  <div className="flex-1 overflow-y-auto pr-1">
    <TablaAlumnos filtro={filtro} onEmptyChange={setSinAlumnos} />
  </div>
</section>


  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="flex items-center justify-between w-full px-2">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Panel de Control</BreadcrumbLink>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex flex-wrap gap-6 items-start justify-between">
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0 w-full">
              <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2 mb-2">
                Mis Cursos
              </h2>
              <div
  className="grid gap-5 w-full auto-cols-[360px] grid-flow-col overflow-x-auto"
  style={{
    gridAutoColumns: "360px",
    gridAutoFlow: "column",
  }}
>
  {snap.cursos.map((curso) => (
    <CursoCard key={curso.id} curso={curso} />
  ))}
</div>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-notojp font-light tracking-tight mb-2">
                Mis Asignaturas
                <span
                  style={{ fontFamily: "var(--font-geist)" }}
                  className="text-zinc-400 ml-3 !text-xs font-light uppercase"
                >
                  total horas / semana:
                </span>
                <span
                  style={{ fontFamily: "var(--font-geist)" }}
                  className="text-emerald-200 ml-3 !text-md font-bold"
                >
                  {totalHoras.toFixed(1)} h
                </span>
              </h2>
              <div className="flex flex-wrap gap-3">
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
            </div>
          </div>

          <div className="mt-5">
            <TablaAlumnos />
          </div>
        </div>
        {cursoAEliminar && (
          <DialogEliminarFlow
            entidad="curso"
            id={cursoAEliminar.id}
            nombre={cursoAEliminar.nombre}
            onClose={() => setCursoAEliminar(null)}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
