"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { asignaturasPorCurso } from "@/store/asignaturasPorCurso";
import { useSnapshot } from "valtio";
import { cargarActividades } from "@/store/actividadesPorCurso";
import { añadirActividad } from "@/store/actividadesPorCurso";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cursoId: string;
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>;
};



export function DialogCrearActividad({
  open,
  onOpenChange,
  cursoId,
  setRefreshKey,
}: Props) {
    console.log("setRefreshKey:", setRefreshKey);

  const snap = useSnapshot(asignaturasPorCurso);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [asignaturaId, setAsignaturaId] = useState("");

  const asignaturas = snap[cursoId] || [];

  const handleGuardar = async () => {
    if (!nombre || !fecha || !asignaturaId) {
      toast.error("Por favor, completa todos los campos.");
      return;
    }

    const nuevaActividad = {
      id: uuidv4(),
      nombre,
      fecha,
      cursoId,
      asignaturaId,
    };

    try {
  await window.electronAPI.guardarActividad(nuevaActividad); 
  añadirActividad(cursoId, nuevaActividad);
  toast.success("Actividad guardada correctamente.");



  // Cerrar modal y reset
  onOpenChange(false);
  setNombre("");
  setFecha("");
  setAsignaturaId("");
} catch (err) {
  toast.error("Error al guardar la actividad.");
  console.error(err);
}

  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear nueva actividad</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Práctica 1"
            />
          </div>

          <div>
            <Label>Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div>
            <Label>Asignatura</Label>
            <select
              value={asignaturaId}
              onChange={(e) => setAsignaturaId(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm bg-background"
            >
              <option value="">Selecciona una asignatura</option>
              {asignaturas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          <Button className="w-full mt-4" onClick={handleGuardar}>
            Guardar actividad
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
