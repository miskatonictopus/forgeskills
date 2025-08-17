"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Alumno = { id: string; nombre: string; apellido: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actividadId: string;
  alumnos: Alumno[];
};

export function DialogNotasActividad({
  open,
  onOpenChange,
  actividadId,
  alumnos,
}: Props) {
  const [notas, setNotas] = useState<Record<string, string>>({});

  const handleChange = (alumnoId: string, value: string) => {
    setNotas((prev) => ({ ...prev, [alumnoId]: value }));
  };

  const handleGuardar = async () => {
    try {
      const payload = {
        actividadId,
        notas: Object.entries(notas).map(([alumnoId, val]) => ({
          alumnoId,
          nota: val === "" ? null : parseFloat(val),
        })),
      };
      const res = await window.electronAPI.actividadGuardarNotas(payload);
      if (res.success) {
        toast.success("Notas guardadas correctamente ✅");
        onOpenChange(false);
        window.dispatchEvent(
          new CustomEvent("actividad:evaluada", { detail: { actividadId } })
        );
      } else {
        toast.error(res.error ?? "Error al guardar notas");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error en IPC");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Poner notas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Alumno</th>
                <th className="text-center py-1">Nota</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-1">
                    {a.apellido}, {a.nombre}
                  </td>
                  <td className="text-center py-1">
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={10}
                      value={notas[a.id] ?? ""}
                      onChange={(e) => handleChange(a.id, e.target.value)}
                      className="w-20 text-center"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button onClick={handleGuardar}>Guardar notas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
