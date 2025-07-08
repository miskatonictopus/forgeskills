"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function CardNombre() {
  const [nombre, setNombre] = useState("")
  const [nombres, setNombres] = useState<{ id: number; nombre: string }[]>([])

  const guardar = async () => {
    if (!nombre.trim()) {
      toast.warning("Introduce un nombre válido")
      return
    }

    try {
      await window.electronAPI.guardarNombre(nombre)
      toast.success("✅ Nombre guardado")
      setNombre("")
      await cargarNombres()
    } catch (err) {
      toast.error("❌ Error guardando nombre")
      console.error(err)
    }
  }

  const cargarNombres = async () => {
    try {
      const data = await window.electronAPI.leerNombres()
      setNombres(data)
      console.log("📋 Nombres en BD:", data)
    } catch (err) {
      console.error("❌ Error al leer nombres", err)
    }
  }

  useEffect(() => {
    cargarNombres()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Introduce un nombre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Escribe tu nombre..."
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Button onClick={guardar}>Enviar</Button>

        <ul className="pt-4 text-sm text-muted-foreground">
          {nombres.map((n) => (
            <li key={n.id}>• {n.nombre}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
