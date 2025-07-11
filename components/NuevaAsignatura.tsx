"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type CE = { codigo: string; descripcion: string }
type RA = { codigo: string; descripcion: string; CE: CE[] }
type Descripcion = { duracion: string; centro: string; empresa: string }

type AsignaturaRemota = {
  id: string
  nombre: string
  creditos: string
  descripcion: Descripcion
  RA: RA[]
}

export default function NuevaAsignatura() {
  const [asignaturasRemotas, setAsignaturasRemotas] = useState<AsignaturaRemota[]>([])
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState<AsignaturaRemota | null>(null)

  // 🔄 Cargar asignaturas desde el JSON remoto
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/miskatonictopus/Auswertecontroller/refs/heads/main/asignaturas_FP.json")
      .then((res) => res.json())
      .then((data: AsignaturaRemota[]) => setAsignaturasRemotas(data))
      .catch((err) => {
        toast.error("Error al cargar asignaturas remotas")
        console.error(err)
      })
  }, [])

  const handleGuardar = async () => {
    if (!asignaturaSeleccionada) {
      toast.error("Selecciona una asignatura")
      return
    }

    try {
      await window.electronAPI.guardarAsignatura(asignaturaSeleccionada)
      toast.success("Asignatura guardada en la base de datos")
    } catch (error) {
      toast.error("Error al guardar la asignatura")
      console.error(error)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="asignatura">Asignatura</Label>
        <Select onValueChange={(id) => {
          const asignatura = asignaturasRemotas.find((a) => a.id === id)
          setAsignaturaSeleccionada(asignatura || null)
        }}>
          <SelectTrigger id="asignatura">
            <SelectValue placeholder="Selecciona una asignatura" />
          </SelectTrigger>
          <SelectContent>
            {asignaturasRemotas.map((asig) => (
              <SelectItem key={asig.id} value={asig.id}>
                {asig.id} – {asig.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleGuardar}>Guardar Asignatura</Button>
    </div>
  )
}
