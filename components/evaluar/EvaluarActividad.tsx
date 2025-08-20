"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type Alumno = { id: string; nombre: string; apellidos: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actividadId: string;
  cursoId: string;
  alumnos: Alumno[]; // pásalos desde store o IPC — así no acoplamos aquí
};

type Nota = { alumnoId: string; nota: number };

export default function EvaluarActividad({
  open,
  onOpenChange,
  actividadId,
  cursoId,
  alumnos,
}: Props) {
  const [notas, setNotas] = useState<Record<string, number>>({}); // alumnoId -> nota
  const media = useMemo(() => {
    const vals = Object.values(notas).filter((n) => !Number.isNaN(n));
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }, [notas]);

  useEffect(() => {
    if (open) {
      // opcional: precargar notas anteriores si existieran
      setNotas({});
    }
  }, [open]);

  const setAll = (value: number) => {
    const clean = Math.max(0, Math.min(10, value));
    const next: Record<string, number> = {};
    for (const a of alumnos) next[a.id] = clean;
    setNotas(next);
  };

  const handleSave = async () => {
    const payload: Nota[] = Object.entries(notas)
      .filter(([, n]) => Number.isFinite(n))
      .map(([alumnoId, nota]) => ({ alumnoId, nota: Number(nota) }));

    if (payload.length === 0) {
      toast.error("No has puesto ninguna nota.");
      return;
    }

    try {
      await (window as any).electronAPI.evaluarActividad(actividadId, payload);
      // Opcional: actualizar store local (estado -> "evaluada")
      // actividadesPorCurso.updateEstado(actividadId, "evaluada")
      toast.success("Actividad evaluada y notas propagadas a los CE.");
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error("No se pudo guardar la evaluación.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Evaluar actividad</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setAll(10)}>Poner 10 a todos</Button>
          <Button variant="secondary" onClick={() => setAll(5)}>Poner 5 a todos</Button>
          <Button variant="secondary" onClick={() => setNotas({})}>Limpiar</Button>
          <div className="ml-auto text-sm opacity-80">Media actual: <b>{media}</b></div>
        </div>

        <Separator className="my-2" />

        <div className="max-h-[50vh] overflow-auto pr-1">
          <div className="grid grid-cols-12 gap-2 px-1 py-1 text-xs font-medium opacity-70">
            <div className="col-span-8">Alumno</div>
            <div className="col-span-4">Nota (0–10)</div>
          </div>
          {alumnos.map((al) => (
            <div key={al.id} className="grid grid-cols-12 items-center gap-2 px-1 py-1">
              <div className="col-span-8 truncate">
                {al.apellidos}, {al.nombre}
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <Label htmlFor={`nota-${al.id}`} className="sr-only">Nota</Label>
                <Input
                  id={`nota-${al.id}`}
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={Number.isFinite(notas[al.id]) ? notas[al.id] : ""}
                  onChange={(e) => {
                    const val = e.currentTarget.value === "" ? NaN : Number(e.currentTarget.value);
                    setNotas((prev) => ({ ...prev, [al.id]: val }));
                  }}
                  className="w-24"
                />
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.1}
                  value={Number.isFinite(notas[al.id]) ? notas[al.id] : 0}
                  onChange={(e) => {
                    const val = Number(e.currentTarget.value);
                    setNotas((prev) => ({ ...prev, [al.id]: val }));
                  }}
                  className="flex-1"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar evaluación</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
