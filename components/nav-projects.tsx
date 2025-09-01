"use client"

import { useState } from "react"
import { DialogEliminarFlow } from "@/components/DialogEliminarFlow"
import { NavCursos } from "@/components/NavCursos"
import { Button } from "@/components/ui/button"
import { AlarmClock } from "lucide-react"
import { FullscreenTimer } from "@/components/FullscreenTimer"

export function NavProjects() {
  const [cursoAEliminar, setCursoAEliminar] = useState<{ id: string; nombre: string } | null>(null)
  const [openTimer, setOpenTimer] = useState(false)

  return (
    <>
      {cursoAEliminar && (
        <DialogEliminarFlow
          entidad="curso"
          id={cursoAEliminar.id}
          nombre={cursoAEliminar.nombre}
          onClose={() => setCursoAEliminar(null)}
        />
      )}

      

      <NavCursos setCursoAEliminar={setCursoAEliminar} />

      
    </>
  )
}
