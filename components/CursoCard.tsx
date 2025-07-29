"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Users, SquarePen, Trash2 } from "lucide-react"
import { DialogAsignarAsignaturas } from "@/components/DialogAsignarAsignaturas"
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso"
// import { setCursoAEliminar } from "@/store/cursoAEliminar"
import { cn } from "@/lib/utils"
import { useEffect } from "react"
import { setAsignaturasCurso } from "@/store/asignaturasPorCurso"


type Curso = {
  id: string
  acronimo: string
  nombre: string
  grado: string
  clase: string
  nivel: string
}

type Props = {
  curso: Curso
}

export function CursoCard({ curso }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const asignaturas = asignaturasPorCurso[curso.id] || []
  const tieneAsignaturas = asignaturas.length > 0

  useEffect(() => {
    window.electronAPI.asignaturasDeCurso(curso.id).then((asignaturas) => {
      setAsignaturasCurso(curso.id, asignaturas)
    })
  }, [curso.id])

  return (
    <>
      <Card className="relative w-[17rem] h-[170px] bg-zinc-900 border border-zinc-700 text-white">
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
        <CardContent className="leading-tight space-y-1 mt-8">
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
              <span className="text-white uppercase">{curso.grado}</span>
            </p>
            <p className="text-xs font-light text-zinc-400">
              Clase:{" "}
              <span className="text-white uppercase">{curso.clase}</span>
            </p>
          </div>

          {/* BOTÓN ASIGNATURAS */}
          <div className="mt-2">
            <Button
              variant={tieneAsignaturas ? "outline" : "secondary"}
              size="sm"
              className={cn(
                "w-full transition-all",
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
        </CardContent>
      </Card>

      <DialogAsignarAsignaturas
        cursoId={curso.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
