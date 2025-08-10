"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Users, SquarePen, PlusCircle, ClipboardList } from "lucide-react";
import { DialogAsignaturas } from "@/components/DialogAsignaturas";
import { DialogCrearActividad } from "@/components/actividades/DialogCrearActividad"; // 👈 importa el diálogo
import { asignaturasPorCurso, setAsignaturasCurso } from "@/store/asignaturasPorCurso";

type Curso = {
  id: string;
  acronimo: string;
  nombre: string;
  grado: string;
  clase: string;
  nivel: string;
};

type Props = { curso: Curso };

export function CursoCard({ curso }: Props) {
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  // 👇 estado para el diálogo de crear actividad
  const [openCrear, setOpenCrear] = useState(false);
  const [asigSeleccionada, setAsigSeleccionada] = useState<{ id: string; nombre: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // se lo pasamos al diálogo

  const router = useRouter();
  const asignaturas = asignaturasPorCurso[curso.id] || [];
  const tieneAsignaturas = asignaturas.length > 0;

  useEffect(() => {
    window.electronAPI.asignaturasDeCurso(curso.id).then((asigs) => {
      setAsignaturasCurso(curso.id, asigs);
    });
  }, [curso.id, refreshKey]);

  const abrirCrearActividad = (asig: { id: string; nombre: string }) => {
    setAsigSeleccionada(asig);
    setOpenCrear(true);
  };

  return (
    <>
      <Card className="min-w-[300px] bg-zinc-900 border border-zinc-700 text-white flex flex-col relative">
        {/* ICONOS ACCIONES */}
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/alumnos/${curso.id}`} className="text-zinc-400 hover:text-emerald-400">
                <Users className="w-4 h-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">Ver alumnos</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-zinc-400 hover:text-emerald-400">
                <SquarePen className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Editar curso</TooltipContent>
          </Tooltip>
        </div>

        {/* CONTENIDO */}
        <CardContent className="leading-tight space-y-1">
          <div>
            <p className="text-4xl font-bold truncate uppercase">
              {curso.acronimo}
              {curso.nivel}
            </p>
            <p className="text-xs font-light text-zinc-400 uppercase">{curso.nombre}</p>
            <div className="flex items-center gap-4">
              <p className="text-xs font-light text-zinc-400">
                Grado: <span className="text-white uppercase">{curso.grado}</span>
              </p>
              <p className="text-xs font-light text-zinc-400">
                Clase: <span className="text-white uppercase">{curso.clase}</span>
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          {!tieneAsignaturas ? (
            <Button
              size="sm"
              aria-label="Asociar asignaturas"
              className="flex items-center gap-2 text-xs mt-2 px-3 py-2 rounded-md bg-white text-black hover:bg-gray-100 transition-all"
              onClick={() => setOpenAdd(true)}
            >
              <PlusCircle className="w-4 h-4" />
              Añadir asignatura/s
            </Button>
          ) : (
            <div className="pt-2 space-y-2 text-xs leading-tight pb-2">
              <ul className="pl-0 space-y-2">
                {asignaturas.map((a) => (
                  <li key={a.id} className="list-none -mx-2 p-2 rounded-md hover:bg-zinc-800/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-muted-foreground mt-[2px]">0{a.id}</span>
                        <span className="text-white">{a.nombre}</span>
                      </div>

                      {/* botón crear actividad para ESTA asignatura */}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Crear actividad para ${a.nombre}`}
                        className="h-7 text-emerald-200 hover:text-emerald-200 hover:bg-emerald-900/20 gap-1 text-xs"
                        onClick={() => abrirCrearActividad(a)}
                      >
                        <PlusCircle className="w-4 h-4" />
                        Crear actividad
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Separator className="my-4" />
        </CardContent>

        <div className="p-3 pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-medium uppercase text-muted-foreground hover:text-white inline-flex items-center gap-1 transition-colors"
            onClick={() => router.push(`/cursos/${curso.id}/actividades`)}
          >
            <ClipboardList className="w-4 h-4" />
            Ver actividades
            <span className="text-xs text-zinc-400 ml-1">(0)</span>
          </Button>
        </div>
      </Card>

      {/* Dialogs */}
      <DialogAsignaturas cursoId={curso.id} open={openAdd} onOpenChange={setOpenAdd} mode="add" />
      <DialogAsignaturas cursoId={curso.id} open={openEdit} onOpenChange={setOpenEdit} mode="edit" />

      {/* 👇 nuestro diálogo de crear actividad, con asignatura preseleccionada */}
      <DialogCrearActividad
        open={openCrear}
        onOpenChange={setOpenCrear}
        cursoId={curso.id}
        setRefreshKey={setRefreshKey}
        asignaturaId={asigSeleccionada?.id}
      />
    </>
  );
}
