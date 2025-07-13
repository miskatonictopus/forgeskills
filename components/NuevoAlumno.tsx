// components/NuevoAlumno.tsx
"use client"

import { useEffect,useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


export default function NuevoAlumno() {
  const [nombre, setNombre] = useState("")
  const [apellidos, setApellidos] = useState("")
  const [cursos, setCursos] = useState<any[]>([]) 
  const [curso, setCurso] = useState("") 

  const [mail, setMail] = useState("")

  useEffect(() => {
    const cargarCursos = async () => {
      const cursosLocales = await window.electronAPI.leerCursos()
      setCursos(cursosLocales)
    }
  
    cargarCursos()
  }, [])

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
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <Label htmlFor="apellidos">Apellidos</Label>
      <Input
        id="apellidos"
        value={apellidos}
        onChange={(e) => setApellidos(e.target.value)}
        placeholder="Ej: García Pérez"
      />
    </div>
    <div>
      <Label htmlFor="nombre">Nombre</Label>
      <Input
        id="nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ej: Laura"
      />
    </div>
  </div>

  <div>
  <Label htmlFor="curso">Curso</Label>
  <Select value={curso} onValueChange={setCurso}>
    <SelectTrigger id="curso">
      <SelectValue placeholder="Selecciona un curso" />
    </SelectTrigger>
    <SelectContent>
      {cursos.map((c) => (
        <SelectItem key={c.id} value={c.id}>
          {c.acronimo} - {c.nombre}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  </div>

  <div>
    <Label htmlFor="mail">Correo electrónico</Label>
    <Input
      type="email"
      id="mail"
      value={mail}
      onChange={(e) => setMail(e.target.value)}
      placeholder="ejemplo@correo.com"
    />
  </div>

  <Button onClick={handleGuardar}>Guardar Alumno</Button>
</div>
  )
}
