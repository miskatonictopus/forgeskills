import { useState } from "react";
import { useSnapshot } from "valtio";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import NuevaAsignatura from "./NuevaAsignatura";

import { cargarAsignaturas } from "@/store/asignaturasPorCurso";

import { cursoStore } from "@/store/cursoStore";
// ⬇️ tu setter que pide (cursoId, asignaturas)
import { setAsignaturasCurso } from "@/store/asignaturasPorCurso";

export default function NuevaAsignaturaDialog() {
  const [open, setOpen] = useState(false);
  const snap = useSnapshot(cursoStore);
  const cursoId = snap.cursoIdActivo ?? null;

  const handleSave = async () => {
    if (cursoId) {
      // 1) volvemos a leer las asignaturas del curso desde el backend
      const asignaturas = await window.electronAPI.asignaturasDeCurso(cursoId);
      // 2) actualizamos el store con la nueva lista
      setAsignaturasCurso(cursoId, asignaturas);
    }
    // 3) cerramos el diálogo
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" disabled={!snap.cursos.length}>
          <Plus className="w-4 h-4 mr-1" />
          Nueva asignatura
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva asignatura</DialogTitle>
        </DialogHeader>

        {cursoId ? (
          <NuevaAsignatura cursoId={cursoId} onSave={handleSave} />
        ) : (
          <div className="text-sm text-muted-foreground">
            Selecciona un curso para crear la asignatura.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
