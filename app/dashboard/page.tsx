"use client";

import { useEffect, useState } from "react";
import { SquarePen, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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

function generarIntervalosHora(inicio: string, fin: string): string[] {
  const resultado: string[] = [];
  let [hora, minuto] = inicio.split(":").map(Number);
  const [horaFin, minutoFin] = fin.split(":").map(Number);

  while (hora < horaFin || (hora === horaFin && minuto <= minutoFin)) {
    const h = hora.toString().padStart(2, "0");
    const m = minuto.toString().padStart(2, "0");
    resultado.push(`${h}:${m}`);

    minuto += 30;
    if (minuto >= 60) {
      minuto = 0;
      hora += 1;
    }
  }

  return resultado;
}


export default function Page() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [openHorario, setOpenHorario] = useState<string | null>(null);
  const [dia, setDia] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");

  useEffect(() => {
    const fetchCursos = async () => {
      try {
        const cursosBD = await window.electronAPI.leerCursos?.();
        setCursos(cursosBD || []);
        console.log("📘 Cursos en BDD:", cursosBD);
      } catch (error) {
        console.error("❌ Error al leer cursos:", error);
        toast.error("No se pudieron cargar los cursos");
      }
    };
    fetchCursos();
  }, []);

  useEffect(() => {
    const fetchAsignaturas = async () => {
      try {
        const asignaturasBD = await window.electronAPI?.leerAsignaturas();
        setAsignaturas(asignaturasBD || []);
        console.log("📗 Asignaturas en BDD:", asignaturasBD);
      } catch (error) {
        console.error("❌ Error al leer asignaturas:", error);
        toast.error("No se pudieron cargar las asignaturas");
      }
    };
    fetchAsignaturas();
  }, []);

  const handleGuardarHorario = () => {
    if (!dia || !horaInicio || !horaFin) {
      toast.error("Completa todos los campos del horario");
      return;
    }
    console.log("📅 Nuevo horario:", { dia, horaInicio, horaFin });
    toast.success("Horario guardado correctamente");
    setOpenHorario(null);
    setDia("");
    setHoraInicio("");
    setHoraFin("");
  };

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
                          Grado: <span className="text-white uppercase">{curso.grado}</span>
                        </p>
                        <p className="text-xs font-light text-zinc-400">
                          Clase: <span className="text-white uppercase">{curso.clase}</span>
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
              </h2>
              <div className="flex flex-wrap gap-3">
                {asignaturas.map((asig) => (
                  <>
                    <Card
                      key={asig.id}
                      className="relative w-auto min-w-[10rem] max-w-[16rem] h-[170px] bg-zinc-900 border border-zinc-700 text-white"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setOpenHorario(asig.id)}
                            className="absolute top-2 left-2"
                          >
                            <Clock className="h-4 w-4 text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer" />
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
                        <p className="text-3xl font-bold truncate uppercase">{asig.id}</p>
                        <p className="text-xs font-light text-zinc-400 uppercase">{asig.nombre}</p>
                        <div className="flex gap-2 text-xs font-light">
                          <p className="text-zinc-400">Créditos: <span className="text-white">{asig.creditos}</span></p>
                          <p className="text-zinc-400">Horas: <span className="text-white">{asig.descripcion?.duracion}</span></p>
                        </div>
                        <p className="text-xs font-bold text-white">
                          RA: <span className="text-white font-light">{asig.RA?.length || 0}</span>
                        </p>
                      </CardContent>
                    </Card>

                    <Dialog open={openHorario === asig.id} onOpenChange={() => setOpenHorario(null)}>
                      <DialogContent className="bg-zinc-900 border border-zinc-700 text-white">
                        <DialogHeader>
                          <DialogTitle>
                            Insertar horario para {asig.id}</DialogTitle>
                          <DialogDescription className="text-zinc-400 uppercase">
                            {asig.nombre}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                        <div className="flex gap-4">
  {/* Día de la semana: 1/2 */}
  <div className="w-1/2 space-y-1">
  <Label className="mb-2">Día de la semana</Label>
    <Select value={dia} onValueChange={setDia}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecciona un día" />
      </SelectTrigger>
      <SelectContent>
        {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map((dia) => (
          <SelectItem key={dia} value={dia}>{dia}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Hora de inicio y fin: 1/2 (25% + 25%) */}
  <div className="w-1/2 flex gap-4">
    {/* Hora de inicio */}
    <div className="w-1/2 space-y-1">
      <Label className="mb-2">inicio</Label>
      <Select value={horaInicio} onValueChange={setHoraInicio}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="inicio" />
        </SelectTrigger>
        <SelectContent>
          {generarIntervalosHora("08:00", "21:00").map((hora) => (
            <SelectItem key={hora} value={hora}>{hora}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* Hora de fin */}
    <div className="w-1/2 space-y-1">
      <Label className="mb-2">fin</Label>
      <Select value={horaFin} onValueChange={setHoraFin}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Hora fin" />
        </SelectTrigger>
        <SelectContent>
          {generarIntervalosHora("08:30", "21:00").map((hora) => (
            <SelectItem key={hora} value={hora}>{hora}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
</div>

                          <Button onClick={handleGuardarHorario} className="w-full mt-2">Guardar horario</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
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