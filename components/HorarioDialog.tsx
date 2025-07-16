"use client"

type Horario = {
  dia: string
  horaInicio: string
  horaFin: string
}

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

function generarIntervalosHora(inicio: string, fin: string): string[] {
  const resultado: string[] = []
  let [hora, minuto] = inicio.split(":").map(Number)
  const [horaFin, minutoFin] = fin.split(":").map(Number)

  while (hora < horaFin || (hora === horaFin && minuto <= minutoFin)) {
    const h = hora.toString().padStart(2, "0")
    const m = minuto.toString().padStart(2, "0")
    resultado.push(`${h}:${m}`)
    minuto += 30
    if (minuto >= 60) {
      minuto = 0
      hora += 1
    }
  }

  return resultado
}

function calcularTotalHoras(horarios: Horario[]): number {
  return horarios.reduce(
    (total, h) => total + calcularDuracion(h.horaInicio, h.horaFin),
    0
  )
}

function calcularDuracion(inicio: string, fin: string): number {
  const [hInicio, mInicio] = inicio.split(":").map(Number)
  const [hFin, mFin] = fin.split(":").map(Number)
  return (hFin * 60 + mFin - (hInicio * 60 + mInicio)) / 60
}

type Props = {
  open: boolean
  onClose: () => void
  asignatura: { id: string; nombre: string }
}

export function HorarioDialog({ open, onClose, asignatura }: Props) {
  const [dia, setDia] = useState("")
  const [horaInicio, setHoraInicio] = useState("")
  const [horaFin, setHoraFin] = useState("")
  const [horarios, setHorarios] = useState<Horario[]>([])

  useEffect(() => {
    if (open) {
      window.electronAPI
        .leerHorarios(asignatura.id)
        .then((data: Horario[]) => setHorarios(data))
        .catch(() => toast.error("Error al leer horarios"))
    }
  }, [open, asignatura.id])

  const handleAñadir = async () => {
    if (!dia || !horaInicio || !horaFin) return

    try {
      await window.electronAPI.guardarHorario({
        asignaturaId: asignatura.id,
        dia,
        horaInicio,
        horaFin,
      })

      const nuevos = await window.electronAPI.leerHorarios(asignatura.id)
      setHorarios(nuevos)
      toast.success("Horario añadido correctamente")
      setDia("")
      setHoraInicio("")
      setHoraFin("")
    } catch (err) {
      toast.error("Error al guardar horario")
      console.error(err)
    }
  }

  const handleEliminar = async (dia: string, horaInicio: string) => {
    try {
      await window.electronAPI.borrarHorario({
        asignaturaId: asignatura.id,
        dia,
        horaInicio,
      })
  
      const actualizados = await window.electronAPI.leerHorarios(asignatura.id)
      setHorarios(actualizados)
      toast.success("Horario eliminado")
    } catch (error) {
      toast.error("Error al borrar horario")
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 text-white">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>Insertar horario para {asignatura.id}</DialogTitle>
            <span className="text-emerald-200 text-4xl font-bold mr-4 whitespace-nowrap">
              {calcularTotalHoras(horarios)}h
            </span>
          </div>
          <DialogDescription className="text-zinc-400 uppercase">
            {asignatura.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex w-full gap-4 items-end">
            <div className="w-1/2 space-y-1">
              <Label className="mb-2">Día de la semana</Label>
              <Select value={dia} onValueChange={setDia}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un día" />
                </SelectTrigger>
                <SelectContent>
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map(
                    (d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="w-1/4 space-y-1">
              <Label className="mb-2">Inicio</Label>
              <Select value={horaInicio} onValueChange={setHoraInicio}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="inicio" />
                </SelectTrigger>
                <SelectContent>
                  {generarIntervalosHora("08:00", "21:00").map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-1/4 space-y-1">
              <Label className="mb-2">Fin</Label>
              <Select value={horaFin} onValueChange={setHoraFin}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="fin" />
                </SelectTrigger>
                <SelectContent>
                  {generarIntervalosHora("08:30", "21:00").map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleAñadir} variant="secondary">
              Añadir
            </Button>
          </div>

          {/* Lista de horarios */}
          {horarios.length > 0 && (
            <ul className="text-sm text-white space-y-2 border-t border-zinc-700 pt-2">
              {horarios.map((h, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center border-b border-zinc-800 pb-1"
                >
                  <span>
                    {h.dia}: {h.horaInicio} → {h.horaFin} ·{" "}
                    <span className="font-bold text-emerald-200">
                      {calcularDuracion(h.horaInicio, h.horaFin)}h
                    </span>
                  </span>
                  <button
  onClick={() => handleEliminar(h.dia, h.horaInicio)}
  className="text-zinc-400 hover:text-red-400"
>
  <Trash2 className="w-4 h-4" />
</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
