"use client";

import { useEffect, useState } from "react";
import { SquarePen, Trash2, Clock, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { MensajeSinHorarios } from "@/components/MensajeSinHorarios";

import TablaAlumnos from "@/components/TablaAlumnos";
import { AppSidebar } from "@/components/app-sidebar";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { HorarioDialog } from "@/components/HorarioDialog";
import React from "react";

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
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [openHorario, setOpenHorario] = useState<string | null>(null);
  const [horariosPorAsignatura, setHorariosPorAsignatura] = useState<
    Record<string, Horario[]>
  >({});

  // Cargar cursos
  useEffect(() => {
    const fetchCursos = async () => {
      try {
        const cursosBD = await window.electronAPI.leerCursos() as Curso[];
        setCursos(cursosBD);
      } catch (error) {
        console.error("❌ Error al leer cursos:", error);
        toast.error("No se pudieron cargar los cursos");
      }
    };
  
    fetchCursos();
  }, []);

  // Cargar asignaturas
  useEffect(() => {
    const fetchAsignaturas = async () => {
      try {
        const asignaturasBD = await window.electronAPI?.leerAsignaturas() as Asignatura[];
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
        const horarios = await window.electronAPI.leerHorarios(asignatura.id) as Horario[];
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

    // Aquí podrías usar: await window.electronAPI.guardarHorario(asignaturaId, nuevosHorarios)
  };

  const cargarAsignaturas = async (id: string) => {
    const nuevas = await window.electronAPI.leerAsignaturas() as Asignatura[];
setAsignaturas(nuevas);
  };

  const totalHoras = Object.values(horariosPorAsignatura)
    .flat()
    .reduce((total, h) => {
      const [h1, m1] = h.horaInicio.split(":").map(Number);
      const [h2, m2] = h.horaFin.split(":").map(Number);
      return total + (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
    }, 0);

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
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-notojp font-light tracking-tight flex items-center gap-2">
                Mis Cursos
              </h2>
              <div className="flex flex-wrap gap-3">
                {cursos.map((curso) => (
                  <Card
                    key={curso.id}
                    className="relative w-auto min-w-[10rem] max-w-[16rem] h-[170px] bg-zinc-900 border border-zinc-700 text-white"
                  >
                    <div className="absolute top-2 right-2 flex gap-2 z-10">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-zinc-400 hover:text-emerald-400">
                            <SquarePen className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-zinc-400 hover:text-emerald-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Borrar</TooltipContent>
                      </Tooltip>
                    </div>
                    <CardContent className="leading-tight space-y-1">
                      <p className="text-3xl font-bold truncate uppercase">
                        {curso.acronimo}
                        {curso.nivel}
                      </p>
                      <p className="text-xs font-light text-zinc-400 uppercase">
                        {curso.nombre}
                      </p>
                      <div className="flex items-center gap-4">
                        <p className="text-xs font-light text-zinc-400">
                          Grado:{" "}
                          <span className="text-white uppercase">
                            {curso.grado}
                          </span>
                        </p>
                        <p className="text-xs font-light text-zinc-400">
                          Clase:{" "}
                          <span className="text-white uppercase">
                            {curso.clase}
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="w-px bg-zinc-700 self-stretch" />

            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-notojp font-light tracking-tight">
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
                    <Card className="w-auto min-w-[10rem] max-w-[16rem] h-[15rem] bg-zinc-900 border border-zinc-700 text-white relative overflow-visible">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              console.log("Click en reloj", asig.id);
                              setOpenHorario(asig.id);
                            }}
                            className="absolute top-2 left-2"
                          >
                            <Clock className="h-4 w-4 text-zinc-400 hover:text-emerald-200 transition-colors cursor-pointer" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Horario</TooltipContent>
                      </Tooltip>

                      <div className="absolute top-2 right-2 flex gap-2 z-10">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-zinc-400 hover:text-emerald-400">
                              <SquarePen className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-zinc-400 hover:text-emerald-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Borrar</TooltipContent>
                        </Tooltip>
                      </div>

                      <CardContent className="leading-tight space-y-1">
                        <p className="text-3xl font-bold truncate uppercase">
                          {asig.id}
                        </p>
                        <p className="text-xs font-light text-zinc-400 uppercase">
                          {asig.nombre}
                        </p>

                        <div className="flex gap-2 text-xs font-light">
                          <p className="text-zinc-400">
                            Créditos:{" "}
                            <span className="text-white">{asig.creditos}</span>
                          </p>
                          <p className="text-zinc-400">
                            Horas:{" "}
                            <span className="text-white">
                              {asig.descripcion?.duracion}
                            </span>
                          </p>
                        </div>

                        <p className="text-xs font-bold text-white">
                          RA:{" "}
                          <span className="text-white font-light">
                            {asig.RA?.length || 0}
                          </span>
                        </p>

                        {/* // HORARIOS // */}
                        {horariosPorAsignatura[asig.id]?.length > 0 ? (
                          <div className="h-px bg-zinc-700 my-2">
                            <div className="mt-1 space-y-1 text-xs text-emerald-200 leading-tight pt-2">
                              {horariosPorAsignatura[asig.id].map((h) => (
                                <div key={`${h.dia}-${h.horaInicio}`}>
                                  {h.dia} {h.horaInicio}–{h.horaFin}
                                </div>
                              ))}
                              <div className="text-xl font-bold">
                                {horariosPorAsignatura[asig.id]
                                  .reduce((total, h) => {
                                    const [h1, m1] = h.horaInicio
                                      .split(":")
                                      .map(Number);
                                    const [h2, m2] = h.horaFin
                                      .split(":")
                                      .map(Number);
                                    return (
                                      total +
                                      (h2 * 60 + m2 - (h1 * 60 + m1)) / 60
                                    );
                                  }, 0)
                                  .toFixed(1)}{" "}
                                h
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="h-px bg-zinc-700 my-2 mb-2"></div>
                            <div className="text-xs text-muted-foreground mt-2 text-red-200">
                              <MensajeSinHorarios />
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
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
      </SidebarInset>
    </SidebarProvider>
  );
}
