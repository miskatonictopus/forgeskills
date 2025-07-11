// components/NuevoAlumno.tsx
"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function NuevoAlumno() {
  const [nombre, setNombre] = useState("")
  const [curso, setCurso] = useState("")

  const handleGuardar = async () => {
    if (!nombre || !curso) {
      toast.error("Rellena todos los campos")
      return
    }

    try {
      const alumno = {
        nombre: nombre.trim(),
        curso: curso.trim(),
      }

      await window.electronAPI.guardarAlumno(alumno)
      toast.success("Alumno guardado")
    } catch (error) {
      toast.error("Error al guardar el alumno")
      console.error(error)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="curso">Curso</Label>
        <Input id="curso" value={curso} onChange={(e) => setCurso(e.target.value)} />
      </div>
      <Button onClick={handleGuardar}>Guardar Alumno</Button>
    </div>
  )
}
