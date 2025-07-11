"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type Asignatura = {
  id: string
  nombre: string
  creditos: string
  descripcion: {
    duracion: string
    centro: string
    empresa: string
  }
  RA: {
    codigo: string
    descripcion: string
    CE: { codigo: string; descripcion: string }[]
  }[]
}

export default function SelectorAsignatura() {
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([])
  const [seleccionada, setSeleccionada] = useState<Asignatura | null>(null)

  useEffect(() => {
    const fetchJSON = async () => {
      try {
        const res = await fetch("https://raw.githubusercontent.com/miskatonictopus/Auswertecontroller/refs/heads/main/asignaturas_FP.json")
        const data = await res.json()
        setAsignaturas(data)
      } catch (error) {
        console.error("Error al cargar asignaturas:", error)
        toast.error("No se pudo cargar el listado de asignaturas")
      }
    }

    fetchJSON()
  }, [])

  const handleGuardar = async () => {
    if (!seleccionada) return toast.error("Selecciona una asignatura")

    try {
      await window.electronAPI.guardarAsignatura(seleccionada)
      toast.success("Asignatura guardada en la base de datos")
    } catch (error) {
      console.error(error)
      toast.error("Error al guardar la asignatura")
    }
  }

  return (
    <div className="space-y-4">
      <Label>Selecciona una asignatura del repositorio oficial</Label>
      <Select
        onValueChange={(id) => {
          const encontrada = asignaturas.find((a) => a.id === id)
          setSeleccionada(encontrada || null)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Código y nombre" />
        </SelectTrigger>
        <SelectContent>
          {asignaturas.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.id} - {a.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={handleGuardar} disabled={!seleccionada}>
        Guardar en SQLite
      </Button>
    </div>
  )
}
