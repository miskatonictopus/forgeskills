"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  setAsignaturasCurso,
  asignaturasPorCurso,
} from "@/store/asignaturasPorCurso";

type Asignatura = {
  id: string;
  nombre: string;
};

type Props = {
  cursoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
};

export function DialogAsignaturas({ cursoId, open, onOpenChange, mode }: Props) {
  const [asignaturasDisponibles, setAsignaturasDisponibles] = React.useState<Asignatura[]>([]);
  const [seleccionadas, setSeleccionadas] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [confirmado, setConfirmado] = React.useState(false);

  React.useEffect(() => {
    if (!open || (mode === "edit" && !confirmado)) return;

    const cargarDatos = async () => {
      setIsLoading(true);
      const disponibles = await window.electronAPI.leerAsignaturas();
      setAsignaturasDisponibles(disponibles);

      const asignadas = await window.electronAPI.asignaturasDeCurso(cursoId);
      setSeleccionadas(new Set(asignadas.map((a) => a.id)));
      setIsLoading(false);
    };

    cargarDatos();
  }, [open, cursoId, confirmado, mode]);

  const toggleSeleccion = (id: string) => {
    setSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
  };

  const handleGuardar = async () => {
    try {
      await window.electronAPI.asociarAsignaturasACurso(cursoId, Array.from(seleccionadas));
      const nuevasAsignaturas = asignaturasDisponibles.filter((a) => seleccionadas.has(a.id));
      setAsignaturasCurso(cursoId, nuevasAsignaturas);

      toast.success(
        mode === "add" ? "Asignaturas añadidas con éxito" : "Asignaturas modificadas"
      );

      onOpenChange(false);
      setConfirmado(false);
    } catch {
      toast.error("Error al guardar las asignaciones");
    }
  };

  const handleCancelar = () => {
    setConfirmado(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Añadir asignaturas" : "Modificar / Eliminar asignaturas"}
            {mode === "edit" && (
              <p className="text-xs font-light uppercase mt-2 text-red-200">
                <span className="font-bold">Atención</span>, este proceso modifica todas las dependencias,
                alumnos y notas asociadas a estas asignaturas. <br />
                <span className="animate-pulse">Esta acción no se puede deshacer</span>
              </p>
            )}
          </DialogTitle>
        </DialogHeader>

        {mode === "edit" && !confirmado ? (
          <div className="space-y-4 mt-4">
            <p className="text-xs text-white font-light uppercase">
              ¿Estás seguro de que deseas continuar?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleCancelar} className="font-light uppercase text-xs">
                Cancelar
              </Button>
              <Button onClick={() => setConfirmado(true)} className="font-light uppercase text-xs">
                Sí, adelante
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {asignaturasDisponibles.map((asig) => (
                <div key={asig.id} className="flex items-center gap-2">
                  <Checkbox
                    id={asig.id}
                    checked={seleccionadas.has(asig.id)}
                    onCheckedChange={() => toggleSeleccion(asig.id)}
                  />
                  <Label htmlFor={asig.id}>{asig.nombre}</Label>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button onClick={handleGuardar} disabled={asignaturasDisponibles.length === 0}>
                Guardar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
