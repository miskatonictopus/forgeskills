"use client"

import { useState } from "react"
import { DialogEliminarFlow } from "@/components/DialogEliminarFlow"
import { NavCursos } from "@/components/NavCursos"

export function NavProjects() {
  const [cursoAEliminar, setCursoAEliminar] = useState<{
    id: string
    nombre: string
  } | null>(null)

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
