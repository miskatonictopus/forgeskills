"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { setAsignaturasCurso, asignaturasPorCurso } from "@/store/asignaturasPorCurso"

type Asignatura = {
  id: string
  nombre: string
}

type Props = {
  cursoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DialogAsignarAsignaturas({ cursoId, open, onOpenChange }: Props) {
  const [asignaturasDisponibles, setAsignaturasDisponibles] = React.useState<Asignatura[]>([])
  const [seleccionadas, setSeleccionadas] = React.useState<Set<string>>(new Set())

  // ✅ Cargar asignaturas disponibles y asociadas al abrir
  const [isLoading, setIsLoading] = React.useState(true)

React.useEffect(() => {
  if (!open) return

  const cargarDatos = async () => {
    setIsLoading(true)

    // 🔄 Carga todas las asignaturas disponibles
    const disponibles = await window.electronAPI.leerAsignaturas()
    setAsignaturasDisponibles(disponibles)

    // 🔄 Carga asignaturas asociadas desde SQLite
    const asignadas = await window.electronAPI.asignaturasDeCurso(cursoId)
    setSeleccionadas(new Set(asignadas.map((a) => a.id)))

    setIsLoading(false)
  }

  cargarDatos()
}, [open, cursoId])

  const toggleSeleccion = (id: string) => {
    setSeleccionadas((prev) => {
      const nuevo = new Set(prev)
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
      return nuevo
    })
  }

  const handleGuardar = async () => {
    try {
      await window.electronAPI.asociarAsignaturasACurso(
        cursoId,
        Array.from(seleccionadas)
      )
      const nuevasAsignaturas = asignaturasDisponibles.filter((a) =>
  seleccionadas.has(a.id)
)

      setAsignaturasCurso(cursoId, nuevasAsignaturas)
  
      toast.success("Asignaturas actualizadas")
      onOpenChange(false)
    } catch (err) {
      toast.error("Error al guardar las asignaciones")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecciona las asignaturas para este curso</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {asignaturasDisponibles.map((asig) => (
            <div key={asig.id} className="flex items-center gap-2">
              <Checkbox
                id={asig.id}
                checked={seleccionadas.has(asig.id)}
                onCheckedChange={() => toggleSeleccion(asig.id)}
              />
              <Label htmlFor={asig.id}>{asig.nombre}</Label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleGuardar} disabled={seleccionadas.size === 0}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
