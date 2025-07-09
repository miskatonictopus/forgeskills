"use client"

import { Save } from "lucide-react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export function NuevoCurso() {
  const [acronimo, setAcronimo] = useState("")
  const [nombre, setNombre] = useState("")
  const [nivel, setNivel] = useState("1")
  const [grado, setGrado] = useState("medio")
  const [clase, setClase] = useState("A")

  // ✅ Emitimos un evento para que page.tsx cierre el modal
  const cerrarModal = () => {
    document.dispatchEvent(new Event("cerrar-curso-modal"))
  }

  const handleGuardar = async () => {
    console.log("🟡 handleGuardar ejecutado")
  
    if (!acronimo || !nombre) {
      toast.error("Todos los campos son obligatorios")
      return
    }
  
    try {
      const curso = {
        id: `${acronimo}${nivel}${clase}`.toUpperCase(),
        acronimo,
        nombre,
        nivel,
        grado,
        clase,
      }
  
      console.log("📤 Enviando curso a Electron:", curso)
  
      const resultado = await window.electronAPI.guardarCurso(curso)
  
      console.log("✅ Curso guardado:", resultado)
  
      toast.success(`Curso guardado como ${acronimo} ${nivel}${clase}`, {
        description: `${nombre} (Grado ${grado})`,
      })
  
      document.dispatchEvent(new Event("cerrar-curso-modal"))
  
    } catch (error) {
      console.error("❌ Error al guardar:", error)
      toast.error("Error al guardar el curso")
    }
  }
  

  return (
    <div className="w-full max-w-md space-y-4 p-4">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label htmlFor="acronimo" className="pb-3">
            Acrónimo
          </Label>
          <Input
            id="acronimo"
            value={acronimo}
            onChange={(e) => setAcronimo(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="Ej: DAMM"
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor="nivel" className="pb-3">
            Nivel
          </Label>
          <Select value={nivel} onValueChange={setNivel}>
            <SelectTrigger id="nivel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="grado" className="pb-3">
            Grado
          </Label>
          <Select value={grado} onValueChange={setGrado}>
            <SelectTrigger id="grado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="medio">Medio</SelectItem>
              <SelectItem value="superior">Superior</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="clase" className="pb-3">
            Clase
          </Label>
          <Select value={clase} onValueChange={setClase}>
            <SelectTrigger id="clase" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="pb-3">Nombre</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Desarrollo de Aplicaciones Multi Plataforma"
        />
      </div>

      <Button onClick={handleGuardar} variant="outline" className="cursor-pointer">
        <Save className="w-4 h-4 mr-2" />
        Guardar Curso
      </Button>
    </div>
  )
}
