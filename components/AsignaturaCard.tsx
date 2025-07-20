"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { ColorSelector } from "@/components/ColorSelector"
import { MensajeSinHorarios } from "@/components/MensajeSinHorarios"
import { Clock, SquarePen, Trash2 } from "lucide-react"
import { toast } from "sonner"


type Horario = {
  dia: string
  horaInicio: string
  horaFin: string
}

type Descripcion = {
  duracion: string
  centro: string
  empresa: string
}

type RA = {
  codigo: string
  descripcion: string
  CE: any[]
}

type Asignatura = {
  id: string
  nombre: string
  creditos: string
  descripcion: Descripcion
  RA: RA[]
  color?: string
}

type Props = {
  asignatura: Asignatura
  horarios: Horario[]
  onOpenHorario: (id: string) => void
  onReload: () => void
}

export function AsignaturaCard({
  asignatura,
  horarios,
  onOpenHorario,
  onReload,
}: Props) {
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

  return (
    <Card
      className="w-[17rem] h-[15rem] bg-zinc-900 border border-zinc-700 text-white relative overflow-visible"
      // style={{ borderLeft: `8px solid ${colorActual}` }}
    >
      {/* Botón Horario */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={() => onOpenHorario(asignatura.id)} className="absolute top-2 left-2">
            <Clock className="h-4 w-4 text-zinc-400 hover:text-emerald-200 transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Horario</TooltipContent>
      </Tooltip>

      {/* Iconos derecha */}
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

      <CardContent className="leading-tight space-y-1">
        <p className="text-3xl font-bold truncate uppercase">{asignatura.id}</p>
        <p className="text-xs font-light text-zinc-400 uppercase">{asignatura.nombre}</p>

        <div className="flex gap-2 text-xs font-light">
          <p className="text-zinc-400">
            Créditos: <span className="text-white">{asignatura.creditos}</span>
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

        {/* Horarios */}
        {horarios.length > 0 ? (
          <div className="h-px bg-zinc-700 my-2">
            <div className="mt-1 space-y-1 text-xs text-emerald-200 leading-tight pt-2">
              {horarios.map((h) => (
                <div key={`${h.dia}-${h.horaInicio}`}>
                  {h.dia} {h.horaInicio}–{h.horaFin}
                </div>
              ))}
              <div className="text-xl font-bold">{totalHoras.toFixed(1)} h</div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-px bg-zinc-700 my-2 mb-2" />
            <div className="text-xs text-red-200">
              <MensajeSinHorarios />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
