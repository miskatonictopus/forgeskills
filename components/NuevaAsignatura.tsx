"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type CE = { codigo: string; descripcion: string };
type RA = { codigo: string; descripcion: string; CE: CE[] };
type Descripcion = { duracion?: string; centro?: string | null; empresa?: string | null };

type AsignaturaRemota = {
  id: string;
  nombre: string;
  creditos?: string;
  descripcion?: Descripcion;
  RA: RA[];
  CE?: any[]; // compat antiguo
};

type Props = { onSave?: () => void };

export default function NuevaAsignatura({ onSave }: Props) {
  const [asignaturasRemotas, setAsignaturasRemotas] = useState<AsignaturaRemota[]>([]);
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState<AsignaturaRemota | null>(null);

  useEffect(() => {
    fetch("https://raw.githubusercontent.com/miskatonictopus/asignaturas_fp/refs/heads/main/asignaturas_FP.json")
      .then((res) => res.json())
      .then((data: AsignaturaRemota[]) => setAsignaturasRemotas(data ?? []))
      .catch((err) => {
        toast.error("Error al cargar asignaturas remotas");
        console.error(err);
      });
  }, []);

  // --- Deduplicación por (id+nombre) y preferencia por la variante más completa (más RA/CE) ---
  const keyFor = (a: AsignaturaRemota) => `${a.id}::${a.nombre.trim().toLowerCase()}`;
  const score = (x: AsignaturaRemota) =>
    (x.RA?.length ?? 0) + (x.RA?.reduce((acc, r) => acc + (r.CE?.length ?? 0), 0) ?? 0);

  const asignaturasUnicas = useMemo(() => {
    const map = new Map<string, AsignaturaRemota>();
    for (const a of asignaturasRemotas) {
      const k = keyFor(a);
      const prev = map.get(k);
      if (!prev || score(a) > score(prev)) {
        map.set(k, a);
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [asignaturasRemotas]);

  const handleSelect = (value: string) => {
    const [id, nombre] = value.split("::");
    const sel = asignaturasUnicas.find((a) => a.id === id && a.nombre === nombre) || null;
    setAsignaturaSeleccionada(sel);
  };

  const handleGuardar = async () => {
    if (!asignaturaSeleccionada) {
      toast.error("Selecciona una asignatura");
      return;
    }
    try {
      await window.electronAPI.guardarAsignatura(asignaturaSeleccionada);
      toast.success("Asignatura guardada en la base de datos");
      onSave?.();
    } catch (error) {
      toast.error("Error al guardar la asignatura");
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="asignatura">Asignatura</Label>
        <Select onValueChange={handleSelect}>
          <SelectTrigger id="asignatura">
            <SelectValue placeholder="Selecciona una asignatura" />
          </SelectTrigger>
          <SelectContent>
  {[...asignaturasUnicas]
    .sort((a, b) => parseInt(a.id) - parseInt(b.id))
    .map((asig) => (
      <SelectItem
        key={`${asig.id}-${asig.nombre}`}     // ✅ key única
        value={`${asig.id}::${asig.nombre}`}  // ✅ value único
      >
        {asig.id} – {asig.nombre}
      </SelectItem>
    ))}
</SelectContent>
        </Select>
      </div>

      <Button onClick={handleGuardar}>Guardar Asignatura</Button>
    </div>
  );
}
