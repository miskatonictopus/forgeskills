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

      {/* Botón para abrir el timer */}
      <div className="px-3 mb-2">
        <Button
          variant="default"
          className="w-full justify-start gap-2"
          onClick={() => setOpenTimer(true)}
        >
          <AlarmClock className="w-4 h-4" />
          Abrir timer de clase
        </Button>
      </div>

      <NavCursos setCursoAEliminar={setCursoAEliminar} />

      {/* Dialog del timer a pantalla completa */}
      <FullscreenTimer open={openTimer} onOpenChange={setOpenTimer} />
    </>
  )
}
