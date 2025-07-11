"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function NuevaAsignatura() {
  const [codigo, setCodigo] = useState("")
  const [nombre, setNombre] = useState("")

  const handleGuardar = async () => {
    if (!codigo || !nombre) {
      toast.error("Rellena todos los campos")
      return
    }

    try {
      const nuevaAsignatura = {
        id: codigo.trim(),
        nombre: nombre.trim(),
      }

      await window.electronAPI.guardarAsignatura(nuevaAsignatura)
      toast.success("Asignatura guardada")
      // Puedes limpiar el formulario o cerrar el modal desde el padre
    } catch (error) {
      toast.error("Error al guardar la asignatura")
      console.error(error)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="codigo">Código</Label>
        <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <Button onClick={handleGuardar}>Guardar Asignatura</Button>
    </div>
  )
}
