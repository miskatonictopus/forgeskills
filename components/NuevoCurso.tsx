"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function NuevoCurso() {
  const [acronimo, setAcronimo] = useState("")
  const [nombre, setNombre] = useState("")
  const [nivel, setNivel] = useState("1")
  const [grado, setGrado] = useState("medio")
  const [clase, setClase] = useState("A")

  const handleGuardar = async () => {
    if (!acronimo || !nombre) {
      toast.error("Todos los campos son obligatorios")
      return
    }

    try {
      const curso = { acronimo, nombre, nivel, grado, clase }
      const resultado = await window.electronAPI.guardarCurso(curso)

      toast.success(`Curso ${resultado.id} guardado correctamente`)

      // Limpieza opcional:
      setAcronimo("")
      setNombre("")
      setNivel("1")
      setGrado("medio")
      setClase("A")
    } catch (error) {
      toast.error("Error al guardar el curso")
      console.error(error)
    }
  }

  return (
    <Card className="w-full max-w-md p-4 border border-zinc-700 bg-zinc-900 text-white">
      <CardHeader>
        <CardTitle>Nuevo Curso</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Acrónimo</Label>
          <Input value={acronimo} onChange={(e) => setAcronimo(e.target.value)} />
        </div>
        <div>
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Nivel</Label>
            <Select value={nivel} onValueChange={setNivel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Grado</Label>
            <Select value={grado} onValueChange={setGrado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medio">Medio</SelectItem>
                <SelectItem value="superior">Superior</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Clase</Label>
            <Select value={clase} onValueChange={setClase}>
              <SelectTrigger>
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
        <Button onClick={handleGuardar} className="w-full bg-green-600 hover:bg-green-700">
          Guardar Curso
        </Button>
      </CardContent>
    </Card>
  )
}
