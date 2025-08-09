"use client"

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ColorSelector } from "@/components/ColorSelector"
import { MensajeSinHorarios } from "@/components/MensajeSinHorarios"
import { SquarePen, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator";

type Horario = { dia: string; horaInicio: string; horaFin: string }
type Descripcion = {
  duracion: string
  centro: string
  empresa: string
  creditos?: string | number // 👈 añadir esto
}
type RA = { codigo: string; descripcion: string; CE: any[] }
type Asignatura = {
  id: string
  nombre: string
  creditos?: number | string
  descripcion: Descripcion
  RA: RA[]
  color?: string
}

type AsignaturaCardProps = {
  asignatura: Asignatura
  horarios: Horario[]
  onOpenHorario: (id: string) => void
  onReload: () => void
}

import type React from "react";

export function AsignaturaCard(props: AsignaturaCardProps): React.JSX.Element {
  const { asignatura, horarios, onOpenHorario, onReload } = props
  const [editandoColor, setEditandoColor] = useState(false)
  const [colorActual, setColorActual] = useState(asignatura.color || "#4B5563")

  const handleColorChange = async (nuevoColor: string) => {
    try {
      setColorActual(nuevoColor)
      setEditandoColor(false)
      await window.electronAPI.actualizarColorAsignatura(asignatura.id, nuevoColor)
      toast.success("Color actualizado")
      onReload()
    } catch (err) {
      toast.error("Error al guardar el color")
    }
  }

  const totalHoras = horarios.reduce((total, h) => {
    const [h1, m1] = h.horaInicio.split(":").map(Number)
    const [h2, m2] = h.horaFin.split(":").map(Number)
    return total + (h2 * 60 + m2 - (h1 * 60 + m1)) / 60
  }, 0)

  const creditosMostrados =
  asignatura.creditos ??
  (asignatura as any)["créditos"] ??
  asignatura.descripcion?.creditos ??
  (asignatura as any).ects ??
  null;

  useEffect(() => {
    console.log("AsignaturaCard >", asignatura);
  }, [asignatura]);

  return (
    <Card className="min-w-[300px] bg-zinc-900 border border-zinc-700 text-white flex flex-col relative">
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="text-zinc-400 hover:text-emerald-400"
              onClick={() => setEditandoColor(!editandoColor)}
            >
              <SquarePen className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Color</TooltipContent>
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

      <CardContent className="leading-tight">
        <p className="text-4xl font-bold truncate uppercase">{asignatura.id}</p>
        <p className="text-xs font-light text-zinc-400 uppercase">{asignatura.nombre}</p>

        <div className="flex gap-2 text-xs font-light">
          <p className="text-zinc-400">
          Créditos: <span className="text-white">{asignatura.creditos ?? "—"}</span>
          </p>
          <p className="text-zinc-400">
            Horas: <span className="text-white">{asignatura.descripcion?.duracion}</span>
          </p>
        </div>

        <p className="text-xs font-bold text-white">
          RA: <span className="font-light">{asignatura.RA?.length || 0}</span>
        </p>

        {editandoColor && (
          <ColorSelector colorActual={colorActual} onSelect={handleColorChange} />
        )}
<Separator className="my-4" />
<div className="pt-2 mt-2 space-y-1 text-xs leading-tight">
  {horarios.length > 0 ? (
    <>
      {horarios.map((h, i) => (
        <div
          key={`${h.dia}-${h.horaInicio}-${i}`}
          className="flex items-center gap-2 group text-emerald-200"
        >
          {/* botón editar horario */}
          <button
            onClick={() => onOpenHorario(asignatura.id)}
            aria-label="Editar horario"
            className="text-emerald-200 hover:text-emerald-400 transition-colors"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </button>

          <span className="tabular-nums">
            {h.dia} {h.horaInicio}–{h.horaFin}
          </span>
        </div>
      ))}
      <div className="text-xl font-bold text-emerald-300">{totalHoras.toFixed(1)} h</div>
    </>
  ) : (
    <div className="text-red-200 text-xs">
      <MensajeSinHorarios onClick={() => onOpenHorario(asignatura.id)} />
    </div>
  )}
</div>
      </CardContent>
    </Card>
  )
}
