"use client"

import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cursoStore } from "@/store/cursoStore"

type Props = {
  entidad: "curso" | "asignatura" | "alumno"
  id: string
  nombre: string
  onClose?: () => void
}

export function DialogEliminarFlow({ entidad, id, nombre, onClose }: Props) {
  const [mostrarAdvertencia, setMostrarAdvertencia] = useState(false)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [textoConfirmacion, setTextoConfirmacion] = useState("")

  // Montar directamente el flujo al aparecer
  useEffect(() => {
    setMostrarAdvertencia(true)
  }, [])

  const resetear = () => {
    setMostrarAdvertencia(false)
    setMostrarConfirmacion(false)
    setTextoConfirmacion("")
    onClose?.()
  }

  const handleEliminar = async () => {
    try {
      await window.electronAPI.borrarCurso(id)
      await cursoStore.cargarCursos()
      toast.success(`Curso "${nombre}" eliminado correctamente`)
      resetear()
    } catch (error) {
      toast.error("❌ Error al eliminar")
    }
  }

  return (
    <>
      {/* Paso 1: Modal de advertencia */}
      <AlertDialog open={mostrarAdvertencia} onOpenChange={setMostrarAdvertencia}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Seguro que quieres eliminar este {entidad}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente{" "}
              <strong>{nombre}</strong> de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetear}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setMostrarAdvertencia(false)
                setTimeout(() => setMostrarConfirmacion(true), 100)
              }}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paso 2: Confirmación textual */}
      <Dialog open={mostrarConfirmacion} onOpenChange={(open) => {
        if (!open) resetear()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmación requerida</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Escribe <strong>{nombre}</strong> para confirmar que deseas eliminar este {entidad}.
          </p>
          <Input
            placeholder={`Escribe: ${nombre}`}
            value={textoConfirmacion}
            onChange={(e) => setTextoConfirmacion(e.target.value)}
          />
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={resetear}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={textoConfirmacion !== nombre}
              onClick={handleEliminar}
            >
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
