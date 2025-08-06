"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Users, SquarePen, Trash2, ClipboardList } from "lucide-react";
import { DialogAsignarAsignaturas } from "@/components/DialogAsignarAsignaturas";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
// import { setCursoAEliminar } from "@/store/cursoAEliminar"
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { setAsignaturasCurso } from "@/store/asignaturasPorCurso";

type Curso = {
  id: string;
  acronimo: string;
  nombre: string;
  grado: string;
  clase: string;
  nivel: string;
};

type Props = {
  curso: Curso;
};

export function CursoCard({ curso }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const asignaturas = asignaturasPorCurso[curso.id] || [];
  const tieneAsignaturas = asignaturas.length > 0;

  useEffect(() => {
    window.electronAPI.asignaturasDeCurso(curso.id).then((asignaturas) => {
      setAsignaturasCurso(curso.id, asignaturas);
    });
  }, [curso.id]);

  return (
    <>
      <Card className="w-[auto] bg-zinc-900 border border-zinc-700 text-white flex flex-col justify-between relative">

        {/* ICONOS ACCIONES */}
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/alumnos/${curso.id}`}
                className="text-zinc-400 hover:text-emerald-400"
              >
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
            <TooltipContent side="top">Editar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              {/* <button
                onClick={() =>
                  setCursoAEliminar({
                    id: curso.id,
                    nombre: curso.acronimo,
                  })
                }
                className="text-zinc-400 hover:text-emerald-400"
              >
                <Trash2 className="w-4 h-4" />
              </button> */}
            </TooltipTrigger>
            <TooltipContent side="top">Borrar</TooltipContent>
          </Tooltip>
        </div>

        {/* CONTENIDO */}
        <CardContent className="leading-tight space-y-1 mt-0">
          <div className="h-[80px]">
            <p className="text-4xl font-bold truncate uppercase">
              {curso.acronimo}
              {curso.nivel}
            </p>
            <p className="text-xs font-light text-zinc-400 uppercase">
              {curso.nombre}
            </p>
            <div className="flex items-center gap-4">
              <p className="text-xs font-light text-zinc-400">
                Grado:{" "}
                <span className="text-white uppercase">{curso.grado}</span>
              </p>
              <p className="text-xs font-light text-zinc-400">
                Clase:{" "}
                <span className="text-white uppercase">{curso.clase}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 my-4">
            <div className="h-px flex-1 bg-zinc-700" />
            <span className="text-xs uppercase text-muted-foreground mt-1">
              Asignaturas
            </span>
            <div className="h-px flex-1 bg-zinc-700" />
          </div>
          {asignaturas.length > 0 && (
            <div className="mt-2">
              <ul className="list-disc list-outside pl-4 text-xs text-white space-y-0.5">
                {asignaturas.map((a) => (
                  <li key={a.id}>
                  <span className="font-mono text-muted-foreground mr-1">{a.id}</span>
                  {a.nombre}
                </li>
                ))}
              </ul>
            </div>
          )}
          {/* BOTÓN ASIGNATURAS */}
        </CardContent>
        <div className="p-1 ml-4">
            <Button
              variant={tieneAsignaturas ? "outline" : "secondary"}
              size="sm"
              className={cn(
                "w-auto transition-all uppercase font-light text-xs",
                !tieneAsignaturas &&
                  "border-dashed text-destructive animate-pulse"
              )}
              onClick={() => setDialogOpen(true)}
            >
              {tieneAsignaturas
                ? "Modificar asignaturas"
                : "+ Asociar asignaturas"}
            </Button>
          </div>
          <div className="p-1 mt-2 ml-4">
  <Link
    href={`/cursos/${curso.id}/actividades`}
    className="text-xs font-light uppercase text-muted-foreground hover:text-white transition-colors inline-flex items-center gap-1"
  >
    <ClipboardList className="w-4 h-4" />
    Ver actividades
    <span className="text-xs text-zinc-400 ml-1">(0)</span>
  </Link>
</div>

      </Card>

      <DialogAsignarAsignaturas
        cursoId={curso.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
