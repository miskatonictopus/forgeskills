"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
// 👇 refrescar y mutación optimista
import { cargarActividades, setEvaluadaEnMemoria } from "@/store/actividadesPorCurso";

type Alumno = { id: string; nombre: string; apellidos: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actividadId: string;
  cursoId: string;
  alumnos: Alumno[];
};

type NotaPayload = { alumnoId: string; nota: number };

export default function EvaluarActividad({
  open,
  onOpenChange,
  actividadId,
  cursoId,
  alumnos,
}: Props) {
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const media = useMemo(() => {
    const vals = Object.values(notas).filter((n) => Number.isFinite(n));
    if (!vals.length) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }, [notas]);

  useEffect(() => {
    if (open) setNotas({});
  }, [open]);

  const setAll = (value: number) => {
    const clean = Math.max(0, Math.min(10, value));
    const next: Record<string, number> = {};
    for (const a of alumnos) next[a.id] = clean;
    setNotas(next);
  };

  const setNota = (alumnoId: string, value: number | null) => {
    setNotas((prev) => ({ ...prev, [alumnoId]: value ?? 0 }));
  };

  const handleSave = async () => {
    if (saving) return;

    const payload: NotaPayload[] = Object.entries(notas)
      .filter(([, n]) => Number.isFinite(n))
      .map(([alumnoId, nota]) => ({ alumnoId, nota: Number(nota) }));

    if (!payload.length) {
      toast.error("No has puesto ninguna nota.");
      return;
    }

    try {
      setSaving(true);

      // 1) Guarda las notas globales por alumno para la actividad
      //    (IPC esperado: actividad:guardar-notas → actividad_nota)
      await (window as any).electronAPI.guardarNotasActividad(actividadId, payload);

      // 2) Propaga a CE y marca la actividad como evaluada
      //    (IPC: actividad:evaluar-y-propagar)
      await (window as any).electronAPI.evaluarYPropagarActividad(actividadId);

      // 3) Mutación optimista + refresco
      setEvaluadaEnMemoria(cursoId, actividadId);
      await cargarActividades(cursoId);

      // 4) Evento global (por si hay listeners)
      window.dispatchEvent(new CustomEvent("actividad:evaluada", { detail: { actividadId } }));

      toast.success("Actividad evaluada y notas propagadas a los CE ✅");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "No se pudo guardar la evaluación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Evaluar actividad</DialogTitle>
        </DialogHeader>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setAll(10)} disabled={saving}>
            Poner 10 a todos
          </Button>
          <Button variant="secondary" onClick={() => setAll(5)} disabled={saving}>
            Poner 5 a todos
          </Button>
          <Button variant="secondary" onClick={() => setNotas({})} disabled={saving}>
            Limpiar
          </Button>
          <div className="ml-auto text-sm text-muted-foreground flex items-center gap-2">
            Media actual: <Badge variant="secondary" className="tabular-nums">{media}</Badge>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Tabla de alumnos */}
        <ScrollArea className="max-h-[52vh]">
          <Table className="w-full">
            <colgroup>
              <col className="w-[45%]" />
              <col className="w-[20%]" />
              <col className="w-[35%]" />
            </colgroup>

            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Ajuste</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {alumnos.map((al) => {
                const val = Number.isFinite(notas[al.id]) ? notas[al.id] : undefined;

                return (
                  <TableRow key={al.id}>
                    <TableCell className="font-medium">
                      {al.apellidos}, {al.nombre}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`nota-${al.id}`} className="sr-only">Nota</Label>
                        <Input
                          id={`nota-${al.id}`}
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          inputMode="decimal"
                          value={val ?? ""}
                          onChange={(e) => {
                            const raw = e.currentTarget.value;
                            if (raw === "") return setNota(al.id, 0);
                            let n = Number(raw);
                            if (Number.isNaN(n)) n = 0;
                            n = Math.max(0, Math.min(10, n));
                            setNota(al.id, n);
                          }}
                          className="w-24"
                          disabled={saving}
                        />
                        <Badge variant="outline" className="tabular-nums">
                          {val ?? 0}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Slider
                        value={[val ?? 0]}
                        min={0}
                        max={10}
                        step={0.1}
                        onValueChange={([n]) => {
                          const clamped = Math.max(0, Math.min(10, n ?? 0));
                          setNota(al.id, Number(clamped.toFixed(1)));
                        }}
                        className="w-full"
                        disabled={saving}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar evaluación"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
